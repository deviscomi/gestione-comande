<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\KdsStatusChanged;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrderItemRequest;
use App\Http\Resources\OrderItemResource;
use App\Models\Dish;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderSend;
use App\Models\Pizza;
use App\Models\Wine;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class OrderItemController extends Controller
{
    use LogsActivity;

    public function index(Order $order): AnonymousResourceCollection
    {
        return OrderItemResource::collection(
            $order->items()
                ->with(['modifications', 'dish.category', 'pizza', 'wine.category'])
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
        );
    }

    public function store(StoreOrderItemRequest $request, Order $order): JsonResponse
    {
        if ($order->status !== 'open') {
            $msg = $order->status === 'locked' ? 'Ordine bloccato — non modificabile' : 'Ordine chiuso — non modificabile';
            return response()->json(['message' => $msg], 422);
        }

        // Pizza senza varianti né note: incrementa l'item identico pendente (spec DRF §4 — "x2 Margherita")
        // La stessa pizza in uscite diverse NON viene aggregata
        if ($request->item_type === 'pizza'
            && empty($request->modifications ?? [])
            && !$request->filled('notes')
        ) {
            $draftSend = $order->sends()->where('send_number', 0)->first();
            if ($draftSend) {
                $existing = OrderItem::where('order_id', $order->id)
                    ->where('order_send_id', $draftSend->id)
                    ->where('item_type', 'pizza')
                    ->where('pizza_id', $request->pizza_id)
                    ->where('uscita', $request->input('uscita', 1))
                    ->where('status', 'pending')
                    ->where(fn($q) => $q->whereNull('notes')->orWhere('notes', ''))
                    ->whereDoesntHave('modifications')
                    ->first();

                if ($existing) {
                    $newQty = $existing->quantity + 1;
                    $existing->update([
                        'quantity'    => $newQty,
                        'total_price' => $existing->unit_price * $newQty,
                    ]);
                    $order->recalculateTotal();
                    return response()->json(
                        new OrderItemResource($existing->fresh()->load(['modifications', 'dish.category', 'pizza', 'wine.category'])),
                        200
                    );
                }
            }
        }

        // Snapshot prezzo al momento dell'ordine
        if ($request->item_type === 'dish') {
            $item_model = Dish::findOrFail($request->dish_id);
            $unitPrice  = $item_model->price;
        } elseif ($request->item_type === 'wine') {
            $item_model = Wine::findOrFail($request->wine_id);
            $unitPrice  = $item_model->price;
        } else {
            $item_model = Pizza::findOrFail($request->pizza_id);
            $unitPrice  = $item_model->base_price;
        }

        $modsTotal  = collect($request->modifications ?? [])->sum('price_change');
        $totalPrice = ($unitPrice + $modsTotal) * $request->quantity;

        $sortOrder = $this->resolveSortOrder($request->item_type, $request, $item_model);

        $item = DB::transaction(function () use ($request, $order, $unitPrice, $totalPrice, $sortOrder) {
            // Send draft (send_number 0): esiste finché non viene inviata la comanda
            $draftSend = $order->sends()
                ->where('send_number', 0)
                ->first();

            if (!$draftSend) {
                $draftSend = $order->sends()->create(['send_number' => 0]);
            }

            $item = OrderItem::create([
                'order_id'      => $order->id,
                'order_send_id' => $draftSend->id,
                'item_type'     => $request->item_type,
                'dish_id'       => $request->dish_id,
                'pizza_id'      => $request->pizza_id,
                'wine_id'       => $request->wine_id,
                'quantity'      => $request->quantity,
                'unit_price'    => $unitPrice,
                'total_price'   => $totalPrice,
                'status'        => 'pending',
                'notes'         => $request->notes,
                'sort_order'    => $sortOrder,
                'uscita'        => $request->input('uscita', 1),
            ]);

            foreach ($request->modifications ?? [] as $mod) {
                $item->modifications()->create($mod);
            }

            $order->recalculateTotal();
            return $item;
        });

        return response()->json(new OrderItemResource($item->load(['modifications', 'dish.category', 'pizza', 'wine.category'])), 201);
    }

    public function update(Request $request, Order $order, OrderItem $item): JsonResponse
    {
        if ($order->status !== 'open') {
            $msg = $order->status === 'locked' ? 'Ordine bloccato — non modificabile' : 'Ordine chiuso — non modificabile';
            return response()->json(['message' => $msg], 422);
        }

        if ($item->status === 'cancelled') {
            return response()->json(['message' => 'Articolo annullato — non modificabile'], 422);
        }

        $request->validate([
            'quantity'         => 'sometimes|integer|min:1',
            'notes'            => 'nullable|string|max:500',
            'unit_price'       => 'sometimes|numeric|min:0',
            'final_unit_price' => 'sometimes|numeric|min:0',
            'uscita'           => 'sometimes|integer|min:1|max:9',
        ]);

        // quantity, notes e uscita solo su articoli non ancora inviati
        if ($item->status === 'sent' && ($request->has('quantity') || $request->has('notes') || $request->has('uscita'))) {
            return response()->json(['message' => 'Quantità, note e uscita modificabili solo prima dell\'invio'], 422);
        }

        $updates = array_filter([
            'quantity'   => $request->has('quantity')   ? $request->quantity   : null,
            'notes'      => $request->has('notes')      ? $request->notes      : null,
            'unit_price' => $request->has('unit_price') ? $request->unit_price : null,
            'uscita'     => $request->has('uscita')     ? $request->uscita     : null,
        ], fn($v) => !is_null($v));

        // Prezzo finale (varianti incluse) → ricava il prezzo base da salvare
        if ($request->has('final_unit_price')) {
            $item->load('modifications');
            $modsTotal = $item->modifications->sum('price_change');
            $updates['unit_price'] = round((float) $request->final_unit_price - (float) $modsTotal, 2);
        }

        if ($updates) {
            $item->update($updates);
        }

        if ($request->has('quantity') || $request->has('unit_price') || $request->has('final_unit_price')) {
            $item->load('modifications');
            $modsTotal = $item->modifications->sum('price_change');
            $item->update([
                'total_price' => round(($item->unit_price + $modsTotal) * $item->quantity, 2),
            ]);
            $order->recalculateTotal();
        }

        return response()->json(
            new OrderItemResource($item->fresh()->load(['modifications', 'dish.category', 'pizza', 'wine.category']))
        );
    }

    public function destroy(Order $order, OrderItem $item): JsonResponse
    {
        if ($order->status !== 'open') {
            $msg = $order->status === 'locked' ? 'Ordine bloccato — non modificabile' : 'Ordine chiuso — non modificabile';
            return response()->json(['message' => $msg], 422);
        }
        if ($item->status === 'sent') {
            // Marca come cancellato invece di eliminare (è già stato inviato)
            $item->update(['status' => 'cancelled']);
            $order->recalculateTotal();

            broadcast(new KdsStatusChanged(
                department: 'all',
                eventType: 'order_update',
                payload: ['order_id' => $order->id]
            ));

            return response()->json(new OrderItemResource($item));
        }
        $item->delete();
        $order->recalculateTotal();
        return response()->json(null, 204);
    }

    private function resolveSortOrder(string $itemType, Request $request, $model): int
    {
        if ($itemType === 'pizza') {
            return 500; // Pizze dopo i piatti cucina
        }
        if ($itemType === 'wine') {
            return 900; // Vini bottiglia: non vanno in cucina, solo nel conto — dopo tutto il resto
        }
        // Usa sort_order della categoria per ordinare per portata
        return $model->category?->sort_order ?? 0;
    }
}
