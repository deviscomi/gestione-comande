<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintJob extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'order_id',
        'order_send_id',
        'order_payment_id',
        'printer_id',
        'print_type',
        'status',
        'attempts',
        'is_reprint',
        'pdf_backup_path',
        'meta',
        'created_at',
        'printed_at',
        'claimed_at',
    ];

    protected function casts(): array
    {
        return [
            'is_reprint' => 'boolean',
            'meta'       => 'array',
            'created_at' => 'datetime',
            'printed_at' => 'datetime',
            'claimed_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function orderSend(): BelongsTo
    {
        return $this->belongsTo(OrderSend::class);
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class);
    }

    public function orderPayment(): BelongsTo
    {
        return $this->belongsTo(OrderPayment::class);
    }

    public function scopePending($q)
    {
        return $q->where('status', 'pending');
    }

    public function scopeFailed($q)
    {
        return $q->where('status', 'failed');
    }

    /**
     * Relazioni necessarie per rendere il payload ESC/POS.
     * Condivise da ProcessPrintJob (socket) e dal fetch dell'agente, così i
     * due percorsi producono esattamente lo stesso output.
     */
    public function scopeWithPrintRelations($q)
    {
        return $q->with([
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
        ]);
    }

    /**
     * Job prelevabili dall'agente di stampa: quelli in attesa, più quelli
     * presi in carico ma con lease scaduto (agente/Pi crashato dopo il fetch).
     */
    public function scopeClaimable($q)
    {
        $leaseCutoff = now()->subSeconds((int) config('printing.agent_lease_seconds', 90));

        return $q->where(function ($q) use ($leaseCutoff) {
            $q->where('status', 'pending')
              ->orWhere(fn ($q) => $q->where('status', 'printing')->where('claimed_at', '<', $leaseCutoff));
        });
    }
}
