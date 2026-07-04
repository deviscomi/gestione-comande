<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Order extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'table_id',
        'user_id',
        'covers',
        'coperto_price',
        'order_number',
        'status',
        'total',
        'opened_at',
        'first_sent_at',
        'closed_at',
        'kds_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'coperto_price'     => 'decimal:2',
            'total'             => 'decimal:2',
            'opened_at'         => 'datetime',
            'first_sent_at'     => 'datetime',
            'closed_at'         => 'datetime',
            'kds_completed_at'  => 'datetime',
        ];
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function sends(): HasMany
    {
        return $this->hasMany(OrderSend::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function kdsStatuses(): HasMany
    {
        return $this->hasMany(KdsStatus::class);
    }

    public function printJobs(): HasMany
    {
        return $this->hasMany(PrintJob::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(OrderPayment::class);
    }

    /**
     * Chiude l'ordine annullando gli item ancora pending, eliminando i PDF di
     * backup stampa e liberando il tavolo. Usato sia dalla chiusura manuale
     * (OrderController::close) sia dalla chiusura forzata in chiusura giornaliera.
     */
    public function forceClose(): void
    {
        $this->items()->where('status', 'pending')->update(['status' => 'cancelled']);
        $this->recalculateTotal();

        $this->printJobs()->whereNotNull('pdf_backup_path')->each(function ($job) {
            if (Storage::exists($job->pdf_backup_path)) {
                Storage::delete($job->pdf_backup_path);
            }
            $job->update(['pdf_backup_path' => null]);
        });

        // Rimuove le righe KDS dell'ordine: le comande spariscono dai monitor
        // cucina/pizzeria/bar (igiene del DB; il filtro status='open' della coda
        // le nasconde comunque già in tempo reale).
        $this->kdsStatuses()->delete();

        $this->update(['status' => 'closed', 'closed_at' => now()]);
        // Da dentro la classe Order, $this->table è la proprietà Eloquent col nome
        // della tabella DB, non la relation: serve chiamare il metodo table().
        $this->table()->update(['status' => 'libero']);
    }

    public function recalculateTotal(): void
    {
        $itemsTotal   = $this->items()->where('status', '!=', 'cancelled')->sum('total_price');
        $copertoTotal = $this->covers * (float)($this->coperto_price ?? 0);
        $this->total  = round($itemsTotal + $copertoTotal, 2);
        $this->save();
    }

    public function copertoTotal(): float
    {
        return round($this->covers * (float)($this->coperto_price ?? 0), 2);
    }

    public function scopeOpen($q)
    {
        return $q->where('status', 'open');
    }

    public function isLocked(): bool
    {
        return $this->status === 'locked';
    }

    /**
     * Vero se ogni riga attiva e ogni coperto hanno residuo zero,
     * calcolato al volo escludendo le allocazioni di pagamenti annullati.
     */
    public function isFullySettled(): bool
    {
        $activeItems = $this->items()->where('status', '!=', 'cancelled')->get();

        $paidByItem = OrderPaymentAllocation::where('allocation_type', 'item')
            ->whereIn('order_item_id', $activeItems->pluck('id'))
            ->whereHas('payment', fn($q) => $q->where('order_id', $this->id)->where('status', '!=', 'voided'))
            ->selectRaw('order_item_id, SUM(quantity) as paid_qty')
            ->groupBy('order_item_id')
            ->pluck('paid_qty', 'order_item_id');

        foreach ($activeItems as $item) {
            $paidQty = (int) ($paidByItem[$item->id] ?? 0);
            if ($paidQty < $item->quantity) {
                return false;
            }
        }

        if ($this->covers > 0) {
            $paidCoperto = OrderPaymentAllocation::where('allocation_type', 'coperto')
                ->whereHas('payment', fn($q) => $q->where('order_id', $this->id)->where('status', '!=', 'voided'))
                ->sum('quantity');

            if ($paidCoperto < $this->covers) {
                return false;
            }
        }

        return true;
    }
}
