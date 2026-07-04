<?php

namespace App\Jobs;

use App\Events\FiscalReceiptStatusChanged;
use App\Models\FiscalDevice;
use App\Models\FiscalReceipt;
use App\Models\OrderPayment;
use App\Models\OrderPaymentAllocation;
use App\Services\Fiscal\DTO\FiscalReceiptLine;
use App\Services\Fiscal\DTO\FiscalReceiptRequest;
use App\Services\Fiscal\DTO\FiscalReceiptResult;
use App\Services\Fiscal\FiscalDriverFactory;
use App\Traits\LogsActivity;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class EmitFiscalReceiptJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, LogsActivity, Queueable, SerializesModels;

    // Nessun retry automatico: un'emissione fiscale duplicata non è annullabile a piacimento.
    public int $tries = 1;

    public function __construct(public int $orderPaymentId) {}

    public function handle(): void
    {
        $payment = OrderPayment::with([
            'allocations.orderItem.dish',
            'allocations.orderItem.pizza',
            'allocations.orderItem.wine',
        ])->findOrFail($this->orderPaymentId);

        $receipt = FiscalReceipt::firstOrCreate(
            ['order_payment_id' => $payment->id],
            ['fiscal_status' => 'pending', 'attempts' => 0]
        );

        if ($receipt->fiscal_status === 'issued') {
            return;
        }

        $receipt->increment('attempts');

        $device = FiscalDevice::active()->first();

        if (! $device) {
            $this->markFailed($receipt, $payment, 'Nessun registratore telematico attivo configurato');
            return;
        }

        $request = new FiscalReceiptRequest(
            orderPaymentId: $payment->id,
            lines: $this->buildLines($payment->allocations),
            totalAmount: (float) $payment->amount,
            amountPaid: (float) $payment->amount,
            changeDue: 0.0,
            paymentMethod: 'non_specificato',
        );

        try {
            $result = FiscalDriverFactory::make($device->driver)->emitReceipt($device, $request);
        } catch (Throwable $e) {
            $result = FiscalReceiptResult::failure($e->getMessage());
        }

        if ($result->success) {
            $receipt->update([
                'fiscal_device_id'      => $device->id,
                'fiscal_status'         => 'issued',
                'fiscal_receipt_number' => $result->fiscalReceiptNumber,
                'lottery_code'          => $result->lotteryCode,
                'fiscal_emitted_at'     => now(),
                'fiscal_error_message'  => null,
                'raw_response'          => $result->rawResponse,
            ]);

            $this->logActivity('FISCAL_RECEIPT_ISSUED',
                "Scontrino fiscale n. {$result->fiscalReceiptNumber} emesso per il pagamento #{$payment->id}",
                $receipt
            );

            broadcast(new FiscalReceiptStatusChanged($receipt->fresh(), $payment->order_id));
        } else {
            $this->markFailed($receipt, $payment, $result->errorMessage ?? 'Emissione scontrino fiscale fallita', $device->id, $result->rawResponse);
        }
    }

    private function markFailed(FiscalReceipt $receipt, OrderPayment $payment, string $message, ?int $deviceId = null, ?array $rawResponse = null): void
    {
        $receipt->update([
            'fiscal_device_id'     => $deviceId,
            'fiscal_status'        => 'failed',
            'fiscal_error_message' => $message,
            'raw_response'         => $rawResponse,
        ]);

        $this->logActivity('FISCAL_RECEIPT_FAILED',
            "Emissione scontrino fiscale fallita per il pagamento #{$payment->id}: {$message}",
            $receipt
        );

        broadcast(new FiscalReceiptStatusChanged($receipt->fresh(), $payment->order_id));
    }

    /**
     * @param \Illuminate\Database\Eloquent\Collection<int, OrderPaymentAllocation> $allocations
     * @return FiscalReceiptLine[]
     */
    private function buildLines($allocations): array
    {
        $vatRate = (float) config('fiscal.default_vat_rate', 0.10);

        return $allocations->map(fn (OrderPaymentAllocation $alloc) => new FiscalReceiptLine(
            description: $this->lineDescription($alloc),
            quantity: (int) $alloc->quantity,
            unitPrice: (float) $alloc->unit_price,
            vatRate: $vatRate,
            total: (float) $alloc->subtotal,
        ))->all();
    }

    private function lineDescription(OrderPaymentAllocation $alloc): string
    {
        if ($alloc->allocation_type === 'coperto') {
            return 'Coperto';
        }

        $item = $alloc->orderItem;

        return match ($item?->item_type) {
            'pizza' => $item->pizza?->name ?? 'Pizza',
            'wine'  => $item->wine?->name ?? 'Vino',
            default => $item?->dish?->name ?? 'Piatto',
        };
    }
}
