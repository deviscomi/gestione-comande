<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DishVariantOption extends Model
{
    protected $fillable = ['dish_variant_group_id', 'name', 'price_add', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return [
            'price_add' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(DishVariantGroup::class, 'dish_variant_group_id');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
