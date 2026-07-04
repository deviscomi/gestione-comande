<?php

namespace App\Services\Fiscal\DTO;

final class FiscalReceiptResult
{
    public function __construct(
        public readonly bool $success,
        public readonly ?string $fiscalReceiptNumber = null,
        public readonly ?string $lotteryCode = null,
        public readonly ?string $errorMessage = null,
        public readonly ?array $rawResponse = null,
    ) {}

    public static function success(?string $fiscalReceiptNumber, ?string $lotteryCode, ?array $rawResponse): self
    {
        return new self(true, $fiscalReceiptNumber, $lotteryCode, null, $rawResponse);
    }

    public static function failure(string $errorMessage, ?array $rawResponse = null): self
    {
        return new self(false, null, null, $errorMessage, $rawResponse);
    }
}
