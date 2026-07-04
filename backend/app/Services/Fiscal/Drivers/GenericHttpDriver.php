<?php

namespace App\Services\Fiscal\Drivers;

use App\Models\FiscalDevice;
use App\Services\Fiscal\Contracts\FiscalDriverInterface;
use App\Services\Fiscal\DTO\FiscalReceiptRequest;
use App\Services\Fiscal\DTO\FiscalReceiptResult;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Driver generico per registratori telematici esposti tramite un webservice HTTP/JSON
 * (es. servizio cloud del produttore, gateway fiscale di terze parti).
 *
 * Contratto:
 *   POST {base_url}/receipt
 *   Body:     { lines: [{description, quantity, unit_price, vat_rate, total}],
 *               total_amount, amount_paid, change_due, payment_method }
 *   Risposta: { success: bool, fiscal_receipt_number: string|null,
 *               lottery_code: string|null, error_message: string|null }
 *
 * Se sul FiscalDevice è impostato auth_token, viene inviato come Bearer token.
 */
class GenericHttpDriver implements FiscalDriverInterface
{
    public function emitReceipt(FiscalDevice $device, FiscalReceiptRequest $request): FiscalReceiptResult
    {
        try {
            $response = $this->client($device)->post(rtrim($device->base_url, '/') . '/receipt', [
                'lines'          => array_map(fn ($line) => $line->toArray(), $request->lines),
                'total_amount'   => $request->totalAmount,
                'amount_paid'    => $request->amountPaid,
                'change_due'     => $request->changeDue,
                'payment_method' => $request->paymentMethod,
            ]);
        } catch (Throwable $e) {
            return FiscalReceiptResult::failure("Connessione al registratore telematico fallita: {$e->getMessage()}");
        }

        return $this->toResult($response);
    }

    public function testConnection(FiscalDevice $device): FiscalReceiptResult
    {
        try {
            $response = $this->client($device)->get(rtrim($device->base_url, '/'));
        } catch (Throwable $e) {
            return FiscalReceiptResult::failure("Connessione al webservice fallita: {$e->getMessage()}");
        }

        if ($response->serverError()) {
            return FiscalReceiptResult::failure("Webservice non raggiungibile: HTTP {$response->status()}");
        }

        return FiscalReceiptResult::success(null, null, null);
    }

    protected function client(FiscalDevice $device): PendingRequest
    {
        $client = Http::timeout(10)->acceptJson();

        if ($device->auth_token) {
            $client = $client->withToken($device->auth_token);
        }

        return $client;
    }

    protected function toResult(Response $response): FiscalReceiptResult
    {
        if ($response->failed()) {
            return FiscalReceiptResult::failure(
                "Errore HTTP {$response->status()} dal registratore telematico",
                $response->json()
            );
        }

        $data = $response->json() ?? [];

        if (empty($data['success'])) {
            return FiscalReceiptResult::failure($data['error_message'] ?? 'Emissione scontrino fiscale fallita', $data);
        }

        return FiscalReceiptResult::success(
            $data['fiscal_receipt_number'] ?? null,
            $data['lottery_code'] ?? null,
            $data
        );
    }
}
