<?php

namespace App\Services\Fiscal\Drivers;

use App\Models\FiscalDevice;
use App\Services\Fiscal\DTO\FiscalReceiptResult;
use Throwable;

/**
 * Driver generico per bridge locali: un servizio software in rete locale che dialoga
 * con il registratore telematico fisico (qualunque marca) ed esporne un'API HTTP/JSON.
 *
 * Contratto:
 *   POST {base_url}/receipt        — identico a GenericHttpDriver (vedi quella classe)
 *   GET  {base_url}/fiscal/status  — stato del bridge e dell'RT collegato,
 *                                     usato per il test di connessione
 */
class GenericBridgeDriver extends GenericHttpDriver
{
    public function testConnection(FiscalDevice $device): FiscalReceiptResult
    {
        try {
            $response = $this->client($device)->get(rtrim($device->base_url, '/') . '/fiscal/status');
        } catch (Throwable $e) {
            return FiscalReceiptResult::failure("Connessione al bridge locale fallita: {$e->getMessage()}");
        }

        if ($response->failed()) {
            return FiscalReceiptResult::failure("Bridge locale non raggiungibile: HTTP {$response->status()}", $response->json());
        }

        return FiscalReceiptResult::success(null, null, $response->json());
    }
}
