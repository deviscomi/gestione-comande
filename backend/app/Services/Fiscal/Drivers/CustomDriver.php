<?php

namespace App\Services\Fiscal\Drivers;

use App\Models\FiscalDevice;
use App\Services\Fiscal\Contracts\FiscalDriverInterface;
use App\Services\Fiscal\DTO\FiscalReceiptRequest;
use App\Services\Fiscal\DTO\FiscalReceiptResult;
use RuntimeException;

/**
 * Driver custom per un registratore telematico di marca non ancora individuata.
 * Punto di estensione: implementare quando il cliente seleziona l'hardware definitivo.
 */
class CustomDriver implements FiscalDriverInterface
{
    public function emitReceipt(FiscalDevice $device, FiscalReceiptRequest $request): FiscalReceiptResult
    {
        throw new RuntimeException("Driver 'custom' non ancora implementato — hardware non selezionato");
    }

    public function testConnection(FiscalDevice $device): FiscalReceiptResult
    {
        throw new RuntimeException("Driver 'custom' non ancora implementato — hardware non selezionato");
    }
}
