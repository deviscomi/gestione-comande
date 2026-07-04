<?php

namespace App\Jobs;

use App\Events\OrderPaymentRegistered;
use App\Events\PrintJobStatusChanged;
use App\Models\PrintJob;
use App\Services\EscPosRenderer;
use App\Services\PdfBackupGenerator;
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

    public function handle(): void
    {
        $job = PrintJob::with([
            'order.table.zone',
            'order.user',
            'order.items.modifications',
            'order.items.dish.category',
            'order.items.pizza',
            'orderSend.items.modifications',
            'orderSend.items.dish.category',
            'orderSend.items.pizza',
            'orderPayment.allocations.orderItem.dish',
            'orderPayment.allocations.orderItem.pizza',
            'orderPayment.allocations.orderItem.wine',
            'printer',
        ])->find($this->printJobId);

        if (!$job || $job->status === 'done') return;

        $printer = $job->printer;
        if (!$printer) {
            $this->fail(new \RuntimeException('Nessuna stampante configurata per ' . $job->print_type));
            return;
        }

        $job->update(['status' => 'printing', 'attempts' => $job->attempts + 1]);
        broadcast(new PrintJobStatusChanged($job->fresh()));

        $payload = EscPosRenderer::render($job);

        if (strlen($payload) === 0) {
            // Reparto senza articoli di propria competenza in questo invio: nessuna
            // stampa fisica dovuta, non è un errore della stampante.
            $job->update(['status' => 'done', 'printed_at' => now()]);
            broadcast(new PrintJobStatusChanged($job->fresh()));
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

        $job->update(['status' => 'done', 'printed_at' => now()]);
        broadcast(new PrintJobStatusChanged($job->fresh()));

        if ($job->order_payment_id && $job->orderPayment) {
            $job->orderPayment->update(['status' => 'printed']);
            broadcast(new OrderPaymentRegistered($job->order->fresh(), $job->orderPayment->fresh()));
        }
    }

    public function failed(\Throwable $exception): void
    {
        $job = PrintJob::find($this->printJobId);
        if (!$job) return;

        $pdfPath = PdfBackupGenerator::generate($job);
        $job->update(['status' => 'failed', 'pdf_backup_path' => $pdfPath]);
        broadcast(new PrintJobStatusChanged($job->fresh()));
    }
}
