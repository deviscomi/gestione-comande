<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\KdsStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\KdsStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ServiceSchedule;
use App\Services\PrintDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KdsController extends Controller
{
    private const DEPARTMENTS = ['cucina', 'pizzeria', 'bar'];

    /**
     * GET /api/v1/kds/queue?department=cucina|pizzeria|bar
     *
     * Ritorna le comande raggruppate per ordine per il reparto richiesto.
     */
    public function queue(Request $request): JsonResponse
    {
        $department = $request->query('department');
        if (!in_array($department, self::DEPARTMENTS)) {
            return response()->json(['message' => 'department deve essere cucina, pizzeria o bar'], 422);
        }

        $cutoff = now()->subMinutes(3);

        // Bar spento nel calendario: il bar non coordina più le chiamate, il ruolo passa alla cucina.
        $barOpen   = ServiceSchedule::isDepartmentActiveToday('bar');
        $barClosed = !$barOpen;

        // Il bar coordina: scopre ordini/uscite anche di cucina e pizzeria, non solo del bar.
        $discoveryDepartments = $department === 'bar'
            ? ['cucina', 'pizzeria', 'bar']
            : [$department];

        $statuses = KdsStatus::whereIn('department', $discoveryDepartments)
            ->whereHas('order', function ($q) use ($cutoff) {
                $q->where('status', 'open')
                    ->where(function ($q) use ($cutoff) {
                        $q->whereNull('kds_completed_at')->orWhere('kds_completed_at', '>=', $cutoff);
                    });
            })
            ->with(['order.table.zone'])
            ->get();

        $orders = $statuses->pluck('order')->unique('id')->keyBy('id');

        if ($department === 'cucina') {
            $pizzaOrders = Order::whereHas('items', function ($q) {
                $q->where('item_type', 'pizza')->where('status', 'sent');
            })
                ->where('status', 'open')
                ->where(function ($q) use ($cutoff) {
                    $q->whereNull('kds_completed_at')->orWhere('kds_completed_at', '>=', $cutoff);
                })
                ->with('table.zone')
                ->get();

            foreach ($pizzaOrders as $order) {
                $orders->put($order->id, $order);
            }
        }

        if ($orders->isEmpty()) {
            return response()->json([]);
        }

        $orderIds = $orders->keys()->values();

        $allItems = OrderItem::whereIn('order_id', $orderIds)
            ->whereIn('status', ['sent', 'cancelled'])
            ->with(['dish.category', 'pizza', 'wine.category', 'modifications', 'send'])
            ->get()
            ->groupBy(fn ($item) => $item->order_id . '_' . $item->uscita);

        $allDeptStatuses = KdsStatus::whereIn('order_id', $orderIds)
            ->get()
            ->groupBy(fn ($s) => $s->order_id . '_' . $s->uscita);

        // Stati del reparto del display (per il bar: solo gli stati 'bar', che guidano le voci proprie).
        $ownStatusesByOrder = $statuses->where('department', $department)->groupBy('order_id');
        // Tutti gli stati di discovery per ordine (per ricavare i numeri uscita lato bar).
        $discoveryStatusesByOrder = $statuses->groupBy('order_id');

        $orders = $orders->sortBy('first_sent_at')->values();

        $comande = $orders
            ->map(function ($order) use ($department, $barOpen, $barClosed, $ownStatusesByOrder, $discoveryStatusesByOrder, $allItems, $allDeptStatuses) {
                $ownUscitePorDept = $ownStatusesByOrder->get($order->id, collect())->keyBy('uscita');

                $usciteNumeri = $department === 'bar'
                    ? $discoveryStatusesByOrder->get($order->id, collect())->pluck('uscita')
                    : $ownUscitePorDept->keys();

                if ($department === 'cucina') {
                    $pizzaUscite = $allItems
                        ->filter(fn ($items, $key) => str_starts_with($key, $order->id . '_'))
                        ->filter(fn ($items) => $items->contains(
                            fn ($i) => $i->item_type === 'pizza' && $i->status === 'sent'
                        ))
                        ->keys()
                        ->map(fn ($key) => (int) substr($key, strlen($order->id . '_')));

                    $usciteNumeri = $usciteNumeri->merge($pizzaUscite);
                }

                $usciteNumeri = $usciteNumeri->unique()->sort()->values();

                $uscite = $usciteNumeri->map(function ($numero) use ($department, $barOpen, $barClosed, $order, $allItems, $allDeptStatuses, $ownUscitePorDept) {
                    $kds         = $ownUscitePorDept->get($numero);
                    $key         = $order->id . '_' . $numero;
                    $uscitaItems = $allItems->get($key, collect());
                    $deptStatusesForUscita = $allDeptStatuses->get($key, collect());

                    $uscitaHasCucina   = $deptStatusesForUscita->contains('department', 'cucina');
                    $uscitaHasPizzeria = $deptStatusesForUscita->contains('department', 'pizzeria');

                    $ownItems = $kds === null
                        ? collect()
                        : $uscitaItems->filter(function ($i) use ($department, $kds) {
                            if ($this->itemDepartment($i) !== $department) {
                                return false;
                            }
                            if ($i->status === 'cancelled') {
                                return in_array($kds->status, ['in_corso', 'pronto']);
                            }
                            return true;
                        });

                    $companionItems = $uscitaItems->filter(
                        fn ($i) => $i->status === 'sent' && $this->itemDepartment($i) !== $department
                    );

                    $otherDepartments = $deptStatusesForUscita
                        ->where('department', '!=', $department)
                        ->map(fn ($s) => ['department' => $s->department, 'status' => $s->status])
                        ->values();

                    $uscitaSentAt = $uscitaItems->pluck('send.sent_at')->filter()->min();

                    // Chi coordina le chiamate dipende dallo stato del bar:
                    //  - bar acceso: il bar chiama cucina e pizzeria (comportamento storico).
                    //  - bar spento: la cucina chiama la pizzeria, ma solo se condividono l'uscita.
                    $callTargets = collect();
                    if ($department === 'bar' && $barOpen) {
                        $callTargets = $deptStatusesForUscita
                            ->whereIn('department', ['cucina', 'pizzeria'])
                            ->sortBy('department')
                            ->map(fn ($s) => $this->buildCallTarget($s, $key, $allItems))
                            ->values();
                    } elseif ($department === 'cucina' && $barClosed && $kds !== null && $uscitaHasPizzeria) {
                        $callTargets = $deptStatusesForUscita
                            ->where('department', 'pizzeria')
                            ->map(fn ($s) => $this->buildCallTarget($s, $key, $allItems))
                            ->values();
                    }

                    // Stato di "chiamata" dell'uscita (toglie l'overlay IN ATTESA su cucina/pizzeria).
                    // Bar spento: la cucina è autonoma; la pizzeria è autonoma se nell'uscita non c'è cucina.
                    $called = $kds && $kds->called_at !== null;
                    if ($barClosed && $kds !== null) {
                        if ($department === 'cucina') {
                            $called = true;
                        } elseif ($department === 'pizzeria') {
                            $called = $uscitaHasCucina ? ($kds->called_at !== null) : true;
                        }
                    }

                    return [
                        'uscita'             => $numero,
                        'kds_status_id'      => $kds?->id,
                        'status'             => $kds?->status,
                        'status_updated_at'  => $kds?->updated_at?->toIso8601String(),
                        'uscita_sent_at'     => $uscitaSentAt?->toIso8601String(),
                        'other_departments'  => $otherDepartments,
                        'read_only'          => $kds === null,
                        'called'             => $called,
                        'call_targets'       => $callTargets->values(),
                        'items'              => $ownItems->values()->map(fn ($i) => $this->formatItem($i)),
                        'companion_items'    => $companionItems->values()->map(fn ($i) => $this->formatItem($i)),
                    ];
                })->values();

                if ($uscite->isEmpty()) {
                    return null;
                }

                $table = $order->table;

                return [
                    'order_id'      => $order->id,
                    'table_number'  => $table->number,
                    'table_suffix'  => $table->suffix,
                    'zone_name'     => $table->zone?->name,
                    'order_number'  => $order->order_number,
                    'sent_at'       => $order->first_sent_at?->toIso8601String(),
                    'completed_at'  => $order->kds_completed_at?->toIso8601String(),
                    'bar_open'      => $barOpen,
                    'uscite'        => $uscite,
                ];
            })
            ->filter()
            ->values();

        return response()->json($comande);
    }

    /**
     * PATCH /api/v1/kds/statuses/{kdsStatus}
     *
     * Body: {"status": "in_corso"|"pronto"}
     */
    public function updateStatus(Request $request, KdsStatus $kdsStatus): JsonResponse
    {
        $request->validate(['status' => 'required|in:in_corso,pronto']);

        $kdsStatus->update([
            'status'     => $request->status,
            'updated_at' => now(),
        ]);

        broadcast(new KdsStatusChanged(
            department: $kdsStatus->department,
            eventType: 'status_update',
            payload: [
                'kds_status_id'     => $kdsStatus->id,
                'order_id'          => $kdsStatus->order_id,
                'order_send_id'     => $kdsStatus->order_send_id,
                'uscita'            => $kdsStatus->uscita,
                'department'        => $kdsStatus->department,
                'status'            => $kdsStatus->status,
                'status_updated_at' => $kdsStatus->updated_at->toIso8601String(),
            ]
        ));

        $order = $kdsStatus->order;

        if ($kdsStatus->status === 'pronto') {
            $allPronto = !KdsStatus::where('order_id', $order->id)->where('status', '!=', 'pronto')->exists();
            if ($allPronto) {
                $order->update(['kds_completed_at' => now()]);
                broadcast(new KdsStatusChanged(
                    department: 'all',
                    eventType: 'order_complete',
                    payload: [
                        'order_id'     => $order->id,
                        'completed_at' => $order->kds_completed_at->toIso8601String(),
                    ]
                ));
            }
        } elseif ($order->kds_completed_at !== null) {
            $order->update(['kds_completed_at' => null]);
        }

        return response()->json(['status' => $kdsStatus->status]);
    }

    /**
     * PATCH /api/v1/kds/statuses/{kdsStatus}/call
     *
     * Il bar "chiama" il reparto: l'uscita esce dallo stato IN ATTESA sul display
     * cucina/pizzeria. Idempotente — la prima chiamata vince.
     */
    public function call(KdsStatus $kdsStatus): JsonResponse
    {
        if (!in_array($kdsStatus->department, ['cucina', 'pizzeria'])) {
            return response()->json(['message' => 'Solo cucina e pizzeria possono essere chiamate'], 422);
        }

        if ($kdsStatus->called_at === null) {
            $kdsStatus->update(['called_at' => now()]);
        }

        broadcast(new KdsStatusChanged(
            department: $kdsStatus->department,
            eventType: 'call',
            payload: [
                'kds_status_id' => $kdsStatus->id,
                'order_id'      => $kdsStatus->order_id,
                'uscita'        => $kdsStatus->uscita,
                'department'    => $kdsStatus->department,
                'called_at'     => $kdsStatus->called_at->toIso8601String(),
            ]
        ));

        return response()->json(['called_at' => $kdsStatus->called_at->toIso8601String()]);
    }

    /**
     * Costruisce la voce "call target" (reparto chiamabile) per un'uscita:
     * stato della chiamata + articoli del reparto in quell'uscita.
     */
    private function buildCallTarget(KdsStatus $status, string $itemsKey, $allItems): array
    {
        $deptItems = $allItems->get($itemsKey, collect())->filter(
            fn ($i) => $i->status === 'sent' && $this->itemDepartment($i) === $status->department
        );

        return [
            'department'    => $status->department,
            'kds_status_id' => $status->id,
            'status'        => $status->status,
            'called'        => $status->called_at !== null,
            'items'         => $deptItems->values()->map(fn ($i) => $this->formatItem($i)),
        ];
    }

    private function itemDepartment(OrderItem $item): string
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

    private function formatItem(OrderItem $item): array
    {
        $name = match ($item->item_type) {
            'pizza' => $item->pizza?->name ?? 'Pizza',
            'wine'  => $item->wine?->name ?? 'Vino',
            default => $item->dish?->name ?? 'Piatto',
        };

        $mods = $item->modifications->map(fn ($m) => [
            'mod_type'  => $m->mod_type,
            'mod_value' => $m->mod_value,
        ])->values()->all();

        // La base della pizza va mostrata SEMPRE nel KDS: il pizzaiolo conta subito
        // quante pizze sono bianche/rosse/ecc. Se il cameriere non ha cambiato la base
        // non esiste un mod 'pizza_base' → si sintetizza dalla base di default della pizza.
        if ($item->item_type === 'pizza'
            && !collect($mods)->contains(fn ($m) => $m['mod_type'] === 'pizza_base')
        ) {
            array_unshift($mods, [
                'mod_type'  => 'pizza_base',
                'mod_value' => $item->pizza?->default_base ?: 'M',
            ]);
        }

        return [
            'id'            => $item->id,
            'item_type'     => $item->item_type,
            'name'          => $name,
            'quantity'      => $item->quantity,
            'notes'         => $item->notes,
            'modifications' => $mods,
            'cancelled'     => $item->status === 'cancelled',
            'is_addition'   => (bool) $item->kds_added_late,
        ];
    }
}
