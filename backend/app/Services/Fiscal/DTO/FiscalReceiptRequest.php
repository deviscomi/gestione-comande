<?php

namespace App\Services\Fiscal\DTO;

final class FiscalReceiptRequest
{
    /**
     * @param FiscalReceiptLine[] $lines
     */
    public function __construct(
        public readonly int $orderPaymentId,
        public readonly array $lines,
        public readonly float $totalAmount,
        public readonly float $amountPaid,
        public readonly float $changeDue,
        public readonly string $paymentMethod,
    ) {}
}
