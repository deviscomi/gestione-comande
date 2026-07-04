<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class PizzaIngredient extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'price_add', 'price_remove', 'is_active'];

    protected function casts(): array
    {
        return [
            'price_add'    => 'decimal:2',
            'price_remove' => 'decimal:2',
            'is_active'    => 'boolean',
        ];
    }

    public function pizzas(): BelongsToMany
    {
        return $this->belongsToMany(Pizza::class, 'pizza_default_ingredients');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
