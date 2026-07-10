<?php

namespace App\Services;

use App\Events\OrderPaymentRegistered;
use App\Events\PrintJobStatusChanged;
use App\Models\PrintJob;

/**
 * Transizioni finali di un PrintJob, condivise dai due percorsi di stampa:
 *  - ProcessPrintJob (driver 'socket', il server apre il socket);
 *  - PrintAgentController::ack (driver 'agent', il Raspberry conferma l'esito).
 *
 * Centralizzarle qui evita che i due percorsi divergano (stato job, evento
 * realtime per il backoffice, stato pagamento, fallback PDF).
 */
class PrintCompletionService
{
    /**
     * Byte ESC/POS del job. Le relazioni vengono caricate se non già presenti,
     * così il render è identico a prescindere da chi chiama.
     */
    public function renderPayload(PrintJob $job): string
    {
        if (! $job->relationLoaded('printer')) {
            $job->load($this->relationNames());
        }

        return EscPosRenderer::render($job);
    }

    /**
     * Stampa andata a buon fine (o payload vuoto: reparto senza articoli propri
     * in questo invio ⇒ nessuna stampa fisica dovuta, non è un errore).
     */
    public function markPrinted(PrintJob $job): void
    {
        $job->update(['status' => 'done', 'printed_at' => now(), 'claimed_at' => null]);
        broadcast(new PrintJobStatusChanged($job->fresh()));

        // Scontrino di acconto: alla stampa il pagamento passa a 'printed'.
        if ($job->order_payment_id && $job->orderPayment) {
            $job->orderPayment->update(['status' => 'printed']);
            broadcast(new OrderPaymentRegistered($job->order->fresh(), $job->orderPayment->fresh()));
        }
    }

    /**
     * Fallimento definitivo (tentativi esauriti / stampante irraggiungibile):
     * genera il PDF di backup e segna il job 'failed' per il backoffice.
     */
    public function markPermanentlyFailed(PrintJob $job, ?string $reason = null): void
    {
        $pdfPath = PdfBackupGenerator::generate($job);
        $job->update(['status' => 'failed', 'pdf_backup_path' => $pdfPath, 'claimed_at' => null]);
        broadcast(new PrintJobStatusChanged($job->fresh()));
    }

    private function relationNames(): array
    {
        return [
            'order.table.zone', 'order.user',
            'order.items.modifications', 'order.items.dish.category', 'order.items.pizza',
            'orderSend.items.modifications', 'orderSend.items.dish.category', 'orderSend.items.pizza',
            'orderPayment.allocations.orderItem.dish',
            'orderPayment.allocations.orderItem.pizza',
            'orderPayment.allocations.orderItem.wine',
            'printer',
        ];
    }
}
