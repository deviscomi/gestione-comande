<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KdsStatus extends Model
{
    public $timestamps = false;

    protected $fillable = ['order_id', 'order_send_id', 'uscita', 'department', 'status', 'called_at', 'updated_at'];

    protected function casts(): array
    {
        return [
            'uscita'     => 'integer',
            'called_at'  => 'datetime',
            'updated_at' => 'datetime',
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
}
