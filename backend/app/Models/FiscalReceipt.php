<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiscalReceipt extends Model
{
    protected $fillable = [
        'order_payment_id',
        'fiscal_device_id',
        'fiscal_status',
        'fiscal_receipt_number',
        'lottery_code',
        'fiscal_emitted_at',
        'fiscal_error_message',
        'attempts',
        'raw_response',
    ];

    protected function casts(): array
    {
        return [
            'fiscal_emitted_at' => 'datetime',
            'raw_response'      => 'array',
        ];
    }

    public function orderPayment(): BelongsTo
    {
        return $this->belongsTo(OrderPayment::class);
    }

    public function fiscalDevice(): BelongsTo
    {
        return $this->belongsTo(FiscalDevice::class);
    }
}
