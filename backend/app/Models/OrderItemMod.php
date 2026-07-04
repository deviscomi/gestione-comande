<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItemMod extends Model
{
    public $timestamps = false;

    protected $fillable = ['order_item_id', 'mod_type', 'mod_value', 'price_change'];

    protected function casts(): array
    {
        return ['price_change' => 'decimal:2'];
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
