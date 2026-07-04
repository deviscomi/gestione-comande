<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\KdsStatusChanged;
use App\Events\OrderSent as OrderSentEvent;
use Illuminate\Http\Request;
use App\Events\TableStatusChanged;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderSendResource;
use App\Models\KdsStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderSend;
use App\Services\PrintDispatcher;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class OrderSendController extends Controller
{
    use LogsActivity;

    public function __construct(private PrintDispatcher $printDispatcher) {}

    public function index(Order $order): AnonymousResourceCollection
    {
        return OrderSendResource::collection(
            $order->sends()
                ->where('send_number', '>', 0)
                ->with(['items.modifications', 'items.dish', 'items.pizza', 'printJobs'])
                ->orderBy('send_number')
                ->get()
        );
    }

    public function show(Order $order, OrderSend $send): OrderSendResource
    {
        $send->load(['items.modifications', 'items.dish', 'items.pizza', 'printJobs']);
        return new OrderSendResource($send);
    }

    public function send(Request $request, Order $order): JsonResponse
    {
        if ($order->status !== 'open') {
            $msg = $order->status === 'locked' ? 'Ordine bloccato — non modificabile' : 'Ordine chiuso — non modificabile';
            return response()->json(['message' => $msg], 422);
        }

        if ($order->covers <= 0) {
            return response()->json([
                'message' => 'Inserire il numero di coperti prima di inviare la comanda'
            ], 422);
        }

        $pendingItems = $order->items()
            ->with(['dish.category', 'pizza', 'modifications'])
            ->where('status', 'pending')
            ->get();

        if ($pendingItems->isEmpty()) {
            return response()->json(['message' => 'Nessun articolo da inviare'], 422);
        }

        // "Tutte a spicchi": imposta taglio spicchi su tutte le pizze pending
        if ($request->boolean('all_spicchi')) {
            foreach ($pendingItems->where('item_type', 'pizza') as $item) {
                $item->modifications()->updateOrCreate(
                    ['mod_type' => 'pizza_cut'],
                    ['mod_value' => 'spicchi', 'price_change' => 0]
                );
            }
            // Ricarica con modifiche aggiornate
            $pendingItems = $order->items()
                ->with(['dish.category', 'pizza', 'modifications'])
                ->where('status', 'pending')
                ->get();
        }

        // Transazione: solo operazioni DB (no stampa — dispatchSync fuori evita rollback su errori di stampa)
        $txResult = DB::transaction(function () use ($order, $pendingItems) {
            $sendNumber = ($order->sends()->where('send_number', '>', 0)->max('send_number') ?? 0) + 1;

            // Promuovi il draft send (send_number=0) invece di eliminarlo:
            // cascadeOnDelete su order_items cancellerebbe tutti gli articoli.
            $draftSend = $order->sends()->where('send_number', 0)->first();
            if ($draftSend) {
                $draftSend->update(['send_number' => $sendNumber, 'sent_at' => now()]);
                $orderSend = $draftSend;
            } else {
                $orderSend = $order->sends()->create([
                    'send_number' => $sendNumber,
                    'sent_at'     => now(),
                ]);
            }

            // Items: solo status → sent (order_send_id è già corretto)
            $pendingItems->each(fn($item) => $item->update(['status' => 'sent']));

            if ($sendNumber === 1) {
                $order->update(['first_sent_at' => now()]);
                $order->table->update(['status' => 'in_corso']);
            }

            $order->recalculateTotal();

            $this->logActivity('ORDER_SENT',
                "Comanda #{$order->order_number} inviata (invio #{$sendNumber}, " . $pendingItems->count() . " articoli)",
                $order
            );

            return compact('orderSend', 'sendNumber');
        });

        // Broadcast e stampa fuori dalla transaction: leggono dati già committati
        $order->refresh();

        if ($txResult['sendNumber'] === 1) {
            broadcast(new TableStatusChanged($order->table->fresh()));
        }
        broadcast(new OrderSentEvent($order, $txResult['orderSend']));
        $sentItems = $order->items()
            ->with(['dish.category', 'pizza', 'modifications'])
            ->where('order_send_id', $txResult['orderSend']->id)
            ->get();

        $printJobs = $this->printDispatcher->dispatch($order, $txResult['orderSend'], $sentItems);

        // Crea/aggiorna KdsStatus per ogni uscita × reparto e notifica i display
        $this->createKdsStatuses($order, $txResult['orderSend'], $sentItems);
        broadcast(new KdsStatusChanged(
            department: 'all',
            eventType: 'new_order',
            payload: ['order_send_id' => $txResult['orderSend']->id]
        ));

        return response()->json([
            'send_id'      => $txResult['orderSend']->id,
            'send_number'  => $txResult['sendNumber'],
            'print_jobs'   => $printJobs->map(fn($j) => [
                'id'         => $j->id,
                'print_type' => $j->print_type,
                'status'     => $j->status,
            ]),
            'table_status' => $order->table->fresh()->status,
        ]);
    }

    private function createKdsStatuses(Order $order, OrderSend $orderSend, Collection $items): void
    {
        $itemsByUscita = $items->groupBy('uscita')->sortKeys();

        foreach ($itemsByUscita as $uscita => $uscitaItems) {
            $itemsByDept = $uscitaItems->groupBy(fn ($item) => $this->itemDepartment($item));

            foreach ($itemsByDept as $dept => $deptItems) {
                if (!in_array($dept, ['cucina', 'pizzeria', 'bar'])) {
                    continue;
                }

                $kdsStatus = KdsStatus::where('order_id', $order->id)
                    ->where('uscita', $uscita)
                    ->where('department', $dept)
                    ->first();

                if (!$kdsStatus) {
                    KdsStatus::create([
                        'order_id'      => $order->id,
                        'order_send_id' => $orderSend->id,
                        'uscita'        => $uscita,
                        'department'    => $dept,
                        'status'        => 'pending',
                    ]);
                    continue;
                }

                if (in_array($kdsStatus->status, ['in_corso', 'pronto'])) {
                    OrderItem::whereIn('id', $deptItems->pluck('id'))->update(['kds_added_late' => true]);

                    $wasPronto = $kdsStatus->status === 'pronto';
                    $kdsStatus->update([
                        'order_send_id' => $orderSend->id,
                        'status'        => 'in_corso',
                        'updated_at'    => now(),
                    ]);

                    if ($wasPronto) {
                        broadcast(new KdsStatusChanged(
                            department: $kdsStatus->department,
                            eventType: 'status_update',
                            payload: [
                                'kds_status_id'     => $kdsStatus->id,
                                'order_id'          => $order->id,
                                'order_send_id'     => $kdsStatus->order_send_id,
                                'uscita'            => $kdsStatus->uscita,
                                'department'        => $kdsStatus->department,
                                'status'            => $kdsStatus->status,
                                'status_updated_at' => $kdsStatus->updated_at->toIso8601String(),
                            ]
                        ));
                    }
                } else {
                    $kdsStatus->update(['order_send_id' => $orderSend->id]);
                }
            }
        }

        $hasUnfinished = KdsStatus::where('order_id', $order->id)->where('status', '!=', 'pronto')->exists();
        if ($hasUnfinished && $order->kds_completed_at !== null) {
            $order->update(['kds_completed_at' => null]);
        }
    }

    private function itemDepartment($item): string
    {
        if ($item->item_type === 'pizza') {
            return 'pizzeria';
        }
        if ($item->item_type === 'wine') {
            return 'bar';
        }
        $catDept = $item->dish?->category?->department ?? 'cucina';
        return in_array($catDept, PrintDispatcher::BAR_DEPARTMENTS) ? 'bar' : $catDept;
    }

    public function reprint(Order $order, OrderSend $send): JsonResponse
    {
        $sourceJobs = $send->printJobs()
            ->where('is_reprint', false)
            ->get();

        if ($sourceJobs->isEmpty()) {
            return response()->json(['message' => 'Nessun job di stampa originale trovato per questo invio'], 422);
        }

        $newJobs = $sourceJobs->map(fn($job) => $this->printDispatcher->reprint($job));

        $this->logActivity('ORDER_REPRINTED',
            "Ristampa comanda #{$order->order_number} (invio #{$send->send_number})",
            $order
        );

        return response()->json([
            'print_jobs' => $newJobs->map(fn($j) => [
                'id'         => $j->id,
                'print_type' => $j->print_type,
                'status'     => $j->status,
            ]),
        ]);
    }
}
