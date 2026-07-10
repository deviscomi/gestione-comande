<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PrintJob;
use App\Services\PrintCompletionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * API per l'agente di stampa locale (Raspberry Pi), modalità PRINT_DRIVER=agent.
 *
 * Flusso (polling):
 *   GET  /agent/print-jobs             → job pronti + byte ESC/POS (base64) + stampante
 *   POST /agent/print-jobs/{job}/ack   → esito (printed|failed) dopo l'invio alla stampante
 *   POST /agent/test-prints/{token}/ack→ conferma di una stampa di test
 *
 * Il server RENDE i byte (riuso EscPosRenderer); il Pi è un semplice relè che
 * apre il socket verso printer.ip:port e inoltra i byte.
 */
class PrintAgentController extends Controller
{
    public function __construct(private PrintCompletionService $completion) {}

    /**
     * GET /agent/print-jobs
     * Restituisce i job prelevabili (li marca 'printing' con lease) e le eventuali
     * stampe di test in coda.
     */
    public function index(): JsonResponse
    {
        $batch = (int) config('printing.agent_batch', 10);

        $jobs = PrintJob::claimable()
            ->withPrintRelations()
            ->orderBy('created_at')
            ->limit($batch)
            ->get();

        $out = [];
        foreach ($jobs as $job) {
            if (! $job->printer) {
                // Nessuna stampante configurata per il reparto: fallimento definitivo.
                $this->completion->markPermanentlyFailed($job, 'Nessuna stampante configurata');
                continue;
            }

            // Presa in carico: lease + incremento tentativi (come i $tries socket).
            $job->update(['status' => 'printing', 'claimed_at' => now(), 'attempts' => $job->attempts + 1]);

            $payload = $this->completion->renderPayload($job);

            if (strlen($payload) === 0) {
                // Reparto senza articoli propri in questo invio: niente da stampare.
                $this->completion->markPrinted($job);
                continue;
            }

            $out[] = [
                'id'          => $job->id,
                'print_type'  => $job->print_type,
                'printer'     => [
                    'name'       => $job->printer->name,
                    'ip_address' => $job->printer->ip_address,
                    'port'       => $job->printer->port,
                ],
                'payload_b64' => base64_encode($payload),
            ];
        }

        return response()->json([
            'jobs'  => $out,
            'tests' => array_values(Cache::get('print_agent:tests', [])),
        ]);
    }

    /**
     * POST /agent/print-jobs/{job}/ack
     * Body: { "status": "printed"|"failed", "error"?: string }
     */
    public function ack(Request $request, PrintJob $job): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:printed,failed',
            'error'  => 'nullable|string',
        ]);

        if ($job->status === 'done') {
            return response()->json(['status' => 'done']); // idempotente
        }

        if ($data['status'] === 'printed') {
            $this->completion->markPrinted($job);
            return response()->json(['status' => 'done']);
        }

        // Fallita: se ha esaurito i tentativi → PDF backup, altrimenti riprovabile.
        $max = (int) config('printing.max_attempts', 5);
        if ($job->attempts >= $max) {
            $this->completion->markPermanentlyFailed($job, $data['error'] ?? null);
            return response()->json(['status' => 'failed']);
        }

        $job->update(['status' => 'pending', 'claimed_at' => null]);
        return response()->json(['status' => 'pending']);
    }

    /**
     * POST /agent/test-prints/{token}/ack
     * Rimuove la stampa di test dalla coda cache dopo che il Pi l'ha stampata.
     */
    public function ackTest(string $token): JsonResponse
    {
        $tests = Cache::get('print_agent:tests', []);
        $tests = array_values(array_filter($tests, fn ($t) => ($t['token'] ?? null) !== $token));
        Cache::put('print_agent:tests', $tests, now()->addMinutes(5));

        return response()->json(['status' => 'ok']);
    }
}
