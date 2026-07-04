<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\TableStatusChanged;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Http\Resources\TableResource;
use App\Models\Order;
use App\Models\Table;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class TableController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Table::with([
                'zone',
                'children',
                'activeOrder' => fn($q) => $q->withCount([
                    'items as pending_count' => fn($q) => $q->where('status', 'pending'),
                ]),
                'children.activeOrder' => fn($q) => $q->withCount([
                    'items as pending_count' => fn($q) => $q->where('status', 'pending'),
                ]),
            ])
            ->whereNull('parent_table_id');
        if ($request->has('zone_id')) $q->where('zone_id', $request->zone_id);
        return TableResource::collection($q->orderBy('zone_id')->orderBy('number')->get());
    }

    public function show(Table $table): TableResource
    {
        $table->load([
            'zone',
            'children',
            'activeOrder' => fn($q) => $q->withCount([
                'items as pending_count' => fn($q) => $q->where('status', 'pending'),
            ]),
        ]);
        return new TableResource($table);
    }

    public function store(Request $request): TableResource
    {
        $request->validate([
            'zone_id' => 'required|exists:zones,id',
            'number'  => 'required|integer|min:1',
        ]);
        $table = Table::create([
            'zone_id' => $request->zone_id,
            'number'  => $request->number,
            'suffix'  => null,
            'status'  => 'libero',
        ]);
        return new TableResource($table);
    }

    public function update(Request $request, Table $table): TableResource
    {
        $request->validate([
            'number' => 'sometimes|integer|min:1',
            'zone_id'=> 'sometimes|exists:zones,id',
        ]);
        $table->update($request->only(['number', 'zone_id']));
        return new TableResource($table);
    }

    public function destroy(Table $table): JsonResponse
    {
        if ($table->status !== 'libero') {
            return response()->json(['message' => 'Impossibile eliminare: il tavolo non è libero'], 422);
        }
        $table->delete();
        return response()->json(null, 204);
    }

    public function updateStatus(Request $request, Table $table): TableResource
    {
        $request->validate(['status' => 'required|in:libero,occupato']);
        $table->update(['status' => $request->status]);
        broadcast(new TableStatusChanged($table));
        return new TableResource($table);
    }

    public function updateCovers(Request $request, Table $table): JsonResponse
    {
        $request->validate(['covers' => 'required|integer|min:0']);
        $order = Order::where('table_id', $table->id)->where('status', 'open')->firstOrFail();
        $order->update(['covers' => $request->covers]);
        $order->recalculateTotal();
        broadcast(new TableStatusChanged($table));
        return response()->json(['covers' => $order->covers, 'total' => $order->total]);
    }

    public function duplicate(Request $request, Table $table): JsonResponse
    {
        $request->validate(['suffix' => 'required|in:bis,tris']);

        if ($table->parent_table_id !== null) {
            return response()->json(['message' => 'Impossibile duplicare: usare il tavolo principale'], 422);
        }

        $suffix = $request->suffix;

        if ($suffix === 'tris') {
            $bisExists = Table::where('zone_id', $table->zone_id)
                ->where('number', $table->number)
                ->where('suffix', 'bis')->exists();
            if (!$bisExists) {
                return response()->json(['message' => 'Impossibile creare Tris senza Bis'], 422);
            }
        }

        $alreadyExists = Table::where('zone_id', $table->zone_id)
            ->where('number', $table->number)
            ->where('suffix', $suffix)->exists();
        if ($alreadyExists) {
            return response()->json(['message' => "Il tavolo {$suffix} esiste già"], 422);
        }

        $duplicate = Table::create([
            'zone_id'         => $table->zone_id,
            'parent_table_id' => $table->id,
            'number'          => $table->number,
            'suffix'          => $suffix,
            'status'          => 'libero',
        ]);

        $this->logActivity('TABLE_DUPLICATED',
            "Creato tavolo {$table->number}{$suffix} (zona {$table->zone->name})",
            $duplicate
        );

        return response()->json(new TableResource($duplicate), 201);
    }

    public function removeDuplicate(Table $table): JsonResponse
    {
        if (! $table->suffix) {
            return response()->json(['message' => 'Questo non è un tavolo duplicato'], 422);
        }
        if ($table->children()->exists()) {
            return response()->json(['message' => 'Impossibile eliminare: prima elimina il tavolo tris'], 422);
        }
        if ($table->orders()->where('status', 'open')->exists()) {
            return response()->json(['message' => 'Tavolo con ordine aperto'], 422);
        }
        $table->delete();
        return response()->json(null, 204);
    }

    public function moveOrder(Request $request, Table $table): JsonResponse
    {
        $request->validate(['target_table_id' => 'required|exists:tables,id']);

        $order = Order::where('table_id', $table->id)->where('status', 'open')->firstOrFail();
        $target = Table::findOrFail($request->target_table_id);

        if (Order::where('table_id', $target->id)->where('status', 'open')->exists()) {
            return response()->json(['message' => 'Tavolo di destinazione già occupato'], 422);
        }

        DB::transaction(function () use ($order, $table, $target) {
            $order->update(['table_id' => $target->id]);
            $table->update(['status' => 'libero']);
            $target->update(['status' => $order->first_sent_at ? 'in_corso' : 'occupato']);
        });

        // Broadcast dopo commit
        broadcast(new TableStatusChanged($table->fresh()));
        broadcast(new TableStatusChanged($target->fresh()));

        $this->logActivity('ORDER_MOVED',
            "Ordine #{$order->order_number} spostato da tavolo {$table->number} a {$target->number}",
            $order
        );

        return response()->json(new OrderResource($order->fresh()));
    }
}
