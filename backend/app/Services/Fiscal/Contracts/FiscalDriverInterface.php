<?php

namespace App\Services\Fiscal\Contracts;

use App\Models\FiscalDevice;
use App\Services\Fiscal\DTO\FiscalReceiptRequest;
use App\Services\Fiscal\DTO\FiscalReceiptResult;

interface FiscalDriverInterface
{
    public function emitReceipt(FiscalDevice $device, FiscalReceiptRequest $request): FiscalReceiptResult;

    public function testConnection(FiscalDevice $device): FiscalReceiptResult;
}
