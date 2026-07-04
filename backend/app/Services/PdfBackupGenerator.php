<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderSend;
use App\Models\PrintJob;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class PdfBackupGenerator
{
    public static function generateOnDemand(Order $order): string
    {
        $order->loadMissing([
            'table.zone',
            'user',
            'items.modifications',
            'items.dish.category',
            'items.pizza',
        ]);

        $lastSendId = $order->sends()
            ->where('send_number', '>', 0)
            ->latest('send_number')
            ->value('id');

        $orderSend = $lastSendId
            ? OrderSend::with(['items.modifications', 'items.dish.category', 'items.pizza'])->find($lastSendId)
            : null;

        // pre_conto.blade.php legge $job->order — riusiamo la view costruendo
        // un PrintJob non persistito con le relazioni già impostate.
        $job = PrintJob::make(['print_type' => 'pre_conto']);
        $job->setRelation('order', $order);
        $job->setRelation('orderSend', $orderSend);

        $html = view('print.pre_conto', ['job' => $job])->render();
        $pdf  = Pdf::loadHTML($html)->setPaper('a4');

        return $pdf->output();
    }

    public static function generate(PrintJob $job): string
    {
        // I job report cassa non sono legati a un ordine: nessun backup PDF "comanda".
        if (!$job->order_id) {
            return '';
        }

        $job->loadMissing([
            'order.table.zone',
            'order.user',
            'order.items.modifications',
            'order.items.dish.category',
            'order.items.pizza',
            'orderSend.items.modifications',
            'orderSend.items.dish.category',
            'orderSend.items.pizza',
        ]);

        $html = view("print.{$job->print_type}", ['job' => $job])->render();
        $pdf  = Pdf::loadHTML($html)->setPaper('a4');

        $path = "print_backups/order_{$job->order_id}_send_{$job->order_send_id}_{$job->print_type}.pdf";
        Storage::put($path, $pdf->output());

        return $path;
    }

    public static function deleteForOrder(int $orderId): void
    {
        $jobs = \App\Models\PrintJob::where('order_id', $orderId)
            ->whereNotNull('pdf_backup_path')
            ->get();

        foreach ($jobs as $job) {
            if (Storage::exists($job->pdf_backup_path)) {
                Storage::delete($job->pdf_backup_path);
            }
            $job->update(['pdf_backup_path' => null]);
        }
    }
}
