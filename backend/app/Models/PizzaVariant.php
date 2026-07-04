<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PizzaVariant extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'code', 'price_add', 'is_active'];

    protected function casts(): array
    {
        return [
            'price_add' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
