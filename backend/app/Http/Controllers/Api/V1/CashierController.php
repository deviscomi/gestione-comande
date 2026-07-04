<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\OrderPaymentRegistered;
use App\Http\Controllers\Controller;
use App\Http\Resources\FiscalReceiptResource;
use App\Models\FiscalReceipt;
use App\Models\Module;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\OrderPaymentAllocation;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Jobs\EmitFiscalReceiptJob;
use App\Jobs\ProcessPrintJob;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class CashierController extends Controller
{
    use LogsActivity;

    public function orders(): JsonResponse
    {
        $orders = Order::with(['table.zone'])
            ->open()
            ->latest('opened_at')
            ->get();

        return response()->json([
            'data' => $orders->map(fn(Order $order) => [
                'id'           => $order->id,
                'order_number' => $order->order_number,
                'table'        => [
                    'id'     => $order->table->id,
                    'number' => $order->table->number,
                    'suffix' => $order->table->suffix,
                    'zone'   => $order->table->zone->name,
                ],
                'total'      => $order->total,
                'is_settled' => $order->isFullySettled(),
            ]),
        ]);
    }

    public function paymentStatus(Order $order): JsonResponse
    {
        $residuals = $this->computeResiduals($order);

        return response()->json([
            'order_id'        => $order->id,
            'order_number'    => $order->order_number,
            'status'          => $order->status,
            'coperto'         => $residuals['coperto'],
            'items'           => $residuals['items']->map(fn($r) => [
                'id'              => $r['item']->id,
                'name'            => $this->itemName($r['item']),
                'quantity'        => $r['item']->quantity,
                'unit_price'      => $r['effective_unit_price'],  // prezzo addebitato (incl. varianti)
                'base_unit_price' => $r['base_unit_price'],       // prezzo base (per la modifica-prezzo)
                'paid_qty'        => $r['paid_qty'],
                'residual_qty'    => $r['residual_qty'],
            ])->values(),
            'residual_total' => $residuals['residual_total'],
            'is_settled'     => $residuals['residual_total'] <= 0.0,
        ]);
    }

    public function storePayment(Request $request, Order $order): JsonResponse
    {
        if ($order->status !== 'open') {
            $msg = $order->status === 'locked' ? 'Ordine bloccato — non modificabile' : 'Ordine chiuso — non modificabile';
            return response()->json(['message' => $msg], 422);
        }

        $request->validate([
            'allocations'                  => 'required|array|min:1',
            'allocations.*.allocation_type'=> 'required|in:item,coperto',
            'allocations.*.order_item_id'  => 'required_if:allocations.*.allocation_type,item|nullable|integer|exists:order_items,id',
            'allocations.*.quantity'       => 'required|integer|min:0',
            'emit_fiscal'                  => 'sometimes|boolean',
        ]);

        $requested = collect($request->allocations)->filter(fn($a) => (int) $a['quantity'] > 0);

        if ($requested->isEmpty()) {
            return response()->json(['message' => 'Nessuna allocazione con quantità maggiore di zero'], 422);
        }

        try {
            $payment = DB::transaction(function () use ($order, $requested) {
                // Lock le righe coinvolte per evitare doppie allocazioni concorrenti
                $order->items()->lockForUpdate()->get();

                $residuals = $this->computeResiduals($order, lock: true);

                // Residui mutabili in array piatti: gli elementi delle Collection sono array
                // copiati per valore, quindi non si può decrementare un elemento condiviso al volo.
                $itemResidualQty = $residuals['items']->mapWithKeys(fn($r) => [$r['item']->id => $r['residual_qty']])->all();
                $itemUnitPrice   = $residuals['items']->mapWithKeys(fn($r) => [$r['item']->id => $r['effective_unit_price']])->all();
                $copertoResidual = $residuals['coperto']['residual'];
                $copertoPrice    = (float) $residuals['coperto']['price'];

                $payment = OrderPayment::create([
                    'order_id' => $order->id,
                    'user_id'  => auth()->id(),
                    'amount'   => 0,
                    'status'   => 'pending',
                ]);

                $amount = 0.0;

                foreach ($requested as $alloc) {
                    $qty = (int) $alloc['quantity'];

                    if ($alloc['allocation_type'] === 'coperto') {
                        if ($qty > $copertoResidual) {
                            throw new \RuntimeException('Quantità coperti superiore al residuo disponibile');
                        }
                        $unitPrice = $copertoPrice;
                        $subtotal  = round($unitPrice * $qty, 2);

                        OrderPaymentAllocation::create([
                            'order_payment_id' => $payment->id,
                            'allocation_type'  => 'coperto',
                            'order_item_id'    => null,
                            'quantity'         => $qty,
                            'unit_price'       => $unitPrice,
                            'subtotal'         => $subtotal,
                        ]);

                        $amount += $subtotal;
                        $copertoResidual -= $qty;
                    } else {
                        $itemId = (int) $alloc['order_item_id'];

                        if (!array_key_exists($itemId, $itemResidualQty)) {
                            throw new \RuntimeException('Riga non valida o annullata');
                        }
                        if ($qty > $itemResidualQty[$itemId]) {
                            throw new \RuntimeException("Quantità superiore al residuo disponibile per la riga #{$itemId}");
                        }

                        $unitPrice = $itemUnitPrice[$itemId];
                        $subtotal  = round($unitPrice * $qty, 2);

                        OrderPaymentAllocation::create([
                            'order_payment_id' => $payment->id,
                            'allocation_type'  => 'item',
                            'order_item_id'    => $itemId,
                            'quantity'         => $qty,
                            'unit_price'       => $unitPrice,
                            'subtotal'         => $subtotal,
                        ]);

                        $amount += $subtotal;
                        $itemResidualQty[$itemId] -= $qty;
                    }
                }

                $payment->update(['amount' => round($amount, 2)]);

                $lastSendId = $order->sends()
                    ->where('send_number', '>', 0)
                    ->latest('send_number')
                    ->value('id');

                $printer = Printer::where('department', 'cassiere')->where('is_active', true)->first();

                $job = PrintJob::create([
                    'order_id'         => $order->id,
                    'order_send_id'    => $lastSendId,
                    'order_payment_id' => $payment->id,
                    'printer_id'       => $printer?->id,
                    'print_type'       => 'scontrino_parziale',
                    'status'           => 'pending',
                    'attempts'         => 0,
                    'is_reprint'       => false,
                ]);

                $payment->update(['print_job_id' => $job->id]);

                return $payment->fresh(['allocations']);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        ProcessPrintJob::dispatch($payment->print_job_id)->onQueue('printing');

        $this->logActivity('PAYMENT_REGISTERED',
            "Pagamento parziale di € " . number_format($payment->amount, 2) . " registrato per ordine #{$order->order_number}",
            $payment
        );

        broadcast(new OrderPaymentRegistered($order->fresh(), $payment));

        // Gestione scontrino fiscale (solo se il modulo è attivo).
        if (Module::isEnabled('fiscal')) {
            if ($request->boolean('emit_fiscal', true)) {
                // Emissione sincrona: il cassiere attende l'esito prima di proseguire.
                EmitFiscalReceiptJob::dispatchSync($payment->id);
            } else {
                // Incasso senza emissione dal sistema: lo scontrino fiscale verrà emesso
                // a mano sul registratore (RT non integrabile). Tracciato come "manual".
                FiscalReceipt::create([
                    'order_payment_id'     => $payment->id,
                    'fiscal_status'        => 'manual',
                    'fiscal_error_message' => 'Scontrino fiscale gestito manualmente sul registratore',
                    'attempts'             => 0,
                ]);

                $this->logActivity('FISCAL_RECEIPT_MANUAL',
                    "Incasso senza emissione fiscale dal sistema per il pagamento #{$payment->id}",
                    $payment
                );
            }
        }

        $fiscalReceipt = $payment->fiscalReceipt()->first();

        return response()->json([
            'id'             => $payment->id,
            'amount'         => $payment->amount,
            'status'         => $payment->status,
            'print_job_id'   => $payment->print_job_id,
            'is_settled'     => $order->fresh()->isFullySettled(),
            'fiscal_receipt' => $fiscalReceipt ? new FiscalReceiptResource($fiscalReceipt) : null,
        ], 201);
    }

    public function voidPayment(OrderPayment $payment): JsonResponse
    {
        if (!$payment->isVoidable()) {
            return response()->json(['message' => 'Pagamento non annullabile'], 422);
        }

        $payment->update([
            'status'    => 'voided',
            'voided_at' => now(),
            'voided_by' => auth()->id(),
        ]);

        $this->logActivity('PAYMENT_VOIDED',
            "Pagamento parziale #{$payment->id} di € " . number_format($payment->amount, 2) . " annullato",
            $payment
        );

        $order = $payment->order->fresh();
        broadcast(new OrderPaymentRegistered($order, $payment->fresh()));

        return response()->json([
            'id'         => $payment->id,
            'status'     => $payment->status,
            'is_settled' => $order->isFullySettled(),
        ]);
    }

    /**
     * Calcola residui per righe e coperto, escludendo le allocazioni di pagamenti annullati.
     * Con $lock=true blocca le righe order_payments/allocations coinvolte (dentro una transazione).
     */
    private function computeResiduals(Order $order, bool $lock = false): array
    {
        $activeItems = $order->items()->where('status', '!=', 'cancelled')->with('modifications')->get();

        $allocQuery = OrderPaymentAllocation::query()
            ->whereHas('payment', function ($q) use ($order, $lock) {
                $q->where('order_id', $order->id)->where('status', '!=', 'voided');
                if ($lock) $q->lockForUpdate();
            });

        $paidByItem = (clone $allocQuery)
            ->where('allocation_type', 'item')
            ->selectRaw('order_item_id, SUM(quantity) as paid_qty')
            ->groupBy('order_item_id')
            ->pluck('paid_qty', 'order_item_id');

        $paidCoperto = (clone $allocQuery)
            ->where('allocation_type', 'coperto')
            ->sum('quantity');

        $items = $activeItems->map(function ($item) use ($paidByItem) {
            $paidQty = (int) ($paidByItem[$item->id] ?? 0);
            // Prezzo effettivo per unità = base + sovrapprezzi varianti/modifiche.
            // È ciò che va realmente addebitato (coincide con total_price / quantity).
            $effective = round((float) $item->unit_price + (float) $item->modifications->sum('price_change'), 2);
            return [
                'item'                 => $item,
                'paid_qty'             => $paidQty,
                'residual_qty'         => max(0, $item->quantity - $paidQty),
                'base_unit_price'      => (float) $item->unit_price,
                'effective_unit_price' => $effective,
            ];
        });

        $copertoPrice    = (float) ($order->coperto_price ?? 0);
        $copertoResidual = max(0, $order->covers - (int) $paidCoperto);

        $residualTotal = $items->sum(fn($r) => round($r['residual_qty'] * $r['effective_unit_price'], 2))
            + round($copertoResidual * $copertoPrice, 2);

        return [
            'items'          => $items,
            'coperto'        => [
                'total'    => $order->covers,
                'paid'     => (int) $paidCoperto,
                'residual' => $copertoResidual,
                'price'    => $copertoPrice,
            ],
            'residual_total' => round($residualTotal, 2),
        ];
    }

    private function itemName($item): ?string
    {
        return match ($item->item_type) {
            'pizza' => $item->pizza?->name,
            'wine'  => $item->wine?->name,
            default => $item->dish?->name,
        };
    }
}
