<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderPayment extends Model
{
    protected $fillable = [
        'order_id',
        'user_id',
        'amount',
        'status',
        'print_job_id',
        'voided_at',
        'voided_by',
    ];

    protected function casts(): array
    {
        return [
            'amount'    => 'decimal:2',
            'voided_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function printJob(): BelongsTo
    {
        return $this->belongsTo(PrintJob::class);
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->withTrashed();
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(OrderPaymentAllocation::class);
    }

    public function fiscalReceipt(): HasOne
    {
        return $this->hasOne(FiscalReceipt::class);
    }

    public function isVoidable(): bool
    {
        return $this->status === 'pending' && $this->order->status !== 'locked';
    }
}
