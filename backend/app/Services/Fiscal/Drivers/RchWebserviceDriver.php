<?php

namespace App\Services\Fiscal\Drivers;

use App\Models\FiscalDevice;
use App\Services\Fiscal\Contracts\FiscalDriverInterface;
use App\Services\Fiscal\DTO\FiscalReceiptRequest;
use App\Services\Fiscal\DTO\FiscalReceiptResult;
use RuntimeException;

/**
 * Driver per registratori telematici RCH esposti tramite il loro webservice proprietario.
 * Hardware non ancora selezionato — implementazione da completare quando
 * verrà scelto il modello/firmware specifico.
 */
class RchWebserviceDriver implements FiscalDriverInterface
{
    public function emitReceipt(FiscalDevice $device, FiscalReceiptRequest $request): FiscalReceiptResult
    {
        throw new RuntimeException("Driver 'rch_webservice' non ancora implementato — hardware non selezionato");
    }

    public function testConnection(FiscalDevice $device): FiscalReceiptResult
    {
        throw new RuntimeException("Driver 'rch_webservice' non ancora implementato — hardware non selezionato");
    }
}
