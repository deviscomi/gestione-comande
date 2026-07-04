<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WineQuantity extends Model
{
    protected $fillable = ['name', 'price_add', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return [
            'price_add'  => 'decimal:2',
            'is_active'  => 'boolean',
        ];
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
