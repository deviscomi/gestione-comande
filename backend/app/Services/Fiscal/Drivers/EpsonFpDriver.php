<?php

namespace App\Services\Fiscal\Drivers;

use App\Models\FiscalDevice;
use App\Services\Fiscal\Contracts\FiscalDriverInterface;
use App\Services\Fiscal\DTO\FiscalReceiptRequest;
use App\Services\Fiscal\DTO\FiscalReceiptResult;
use RuntimeException;

/**
 * Driver per registratori telematici Epson FP (protocollo proprietario).
 * Hardware non ancora selezionato — implementazione da completare quando
 * verrà scelto il modello/firmware specifico.
 */
class EpsonFpDriver implements FiscalDriverInterface
{
    public function emitReceipt(FiscalDevice $device, FiscalReceiptRequest $request): FiscalReceiptResult
    {
        throw new RuntimeException("Driver 'epson_fp' non ancora implementato — hardware non selezionato");
    }

    public function testConnection(FiscalDevice $device): FiscalReceiptResult
    {
        throw new RuntimeException("Driver 'epson_fp' non ancora implementato — hardware non selezionato");
    }
}
