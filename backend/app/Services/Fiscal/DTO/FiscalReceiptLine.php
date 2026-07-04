<?php

namespace App\Services\Fiscal\DTO;

final class FiscalReceiptLine
{
    public function __construct(
        public readonly string $description,
        public readonly int $quantity,
        public readonly float $unitPrice,
        public readonly float $vatRate,
        public readonly float $total,
    ) {}

    public function toArray(): array
    {
        return [
            'description' => $this->description,
            'quantity'    => $this->quantity,
            'unit_price'  => $this->unitPrice,
            'vat_rate'    => $this->vatRate,
            'total'       => $this->total,
        ];
    }
}
