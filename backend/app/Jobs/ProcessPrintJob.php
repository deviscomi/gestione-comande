<?php

namespace App\Jobs;

use App\Events\PrintJobStatusChanged;
use App\Models\PrintJob;
use App\Services\PrintCompletionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessPrintJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 5;   // 5 tentativi totali, poi fallback PDF
    public int $backoff = 8;   // 8s tra un tentativo e il successivo (stampante può essere in sleep)
    public int $timeout = 25;  // deve contenere il socket timeout (15s) + overhead

    public function __construct(public int $printJobId) {}

    public function handle(PrintCompletionService $completion): void
    {
        $job = PrintJob::withPrintRelations()->find($this->printJobId);

        if (!$job || $job->status === 'done') return;

        $printer = $job->printer;
        if (!$printer) {
            $this->fail(new \RuntimeException('Nessuna stampante configurata per ' . $job->print_type));
            return;
        }

        $job->update(['status' => 'printing', 'attempts' => $job->attempts + 1]);
        broadcast(new PrintJobStatusChanged($job->fresh()));

        $payload = $completion->renderPayload($job);

        if (strlen($payload) === 0) {
            // Reparto senza articoli di propria competenza in questo invio: nessuna
            // stampa fisica dovuta, non è un errore della stampante.
            $completion->markPrinted($job);
            return;
        }

        $socket = @fsockopen($printer->ip_address, $printer->port, $errno, $errstr, 15);

        if (!$socket) {
            // Lancia eccezione: la queue riprova dopo $backoff secondi.
            // Dopo $tries tentativi falliti viene chiamato failed() → PDF backup.
            throw new \RuntimeException(
                "Stampante [{$printer->name}] non raggiungibile a {$printer->ip_address}:{$printer->port} — {$errstr} (errno {$errno})"
            );
        }

        $written = fwrite($socket, $payload);
        fflush($socket);
        fclose($socket);

        if ($written === false || $written === 0) {
            throw new \RuntimeException(
                "Scrittura socket fallita o payload vuoto verso [{$printer->name}] {$printer->ip_address}:{$printer->port} (scritti: {$written})"
            );
        }

        $completion->markPrinted($job);
    }

    public function failed(\Throwable $exception): void
    {
        $job = PrintJob::find($this->printJobId);
        if (!$job) return;

        app(PrintCompletionService::class)->markPermanentlyFailed($job, $exception->getMessage());
    }
}
