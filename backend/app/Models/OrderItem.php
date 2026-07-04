<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'order_id',
        'order_send_id',
        'item_type',
        'dish_id',
        'pizza_id',
        'wine_id',
        'quantity',
        'unit_price',
        'total_price',
        'status',
        'notes',
        'sort_order',
        'uscita',
        'kds_added_late',
    ];

    protected function casts(): array
    {
        return [
            'unit_price'     => 'decimal:2',
            'total_price'    => 'decimal:2',
            'created_at'     => 'datetime',
            'uscita'         => 'integer',
            'kds_added_late' => 'boolean',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function send(): BelongsTo
    {
        return $this->belongsTo(OrderSend::class, 'order_send_id');
    }

    public function modifications(): HasMany
    {
        return $this->hasMany(OrderItemMod::class);
    }

    public function dish(): BelongsTo
    {
        return $this->belongsTo(Dish::class);
    }

    public function pizza(): BelongsTo
    {
        return $this->belongsTo(Pizza::class);
    }

    public function wine(): BelongsTo
    {
        return $this->belongsTo(Wine::class);
    }

    public function paymentAllocations(): HasMany
    {
        return $this->hasMany(OrderPaymentAllocation::class);
    }
}
