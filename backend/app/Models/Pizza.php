<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Pizza extends Model
{
    protected $fillable = ['name', 'description', 'base_price', 'is_active', 'default_base'];

    protected function casts(): array
    {
        return [
            'base_price' => 'decimal:2',
            'is_active'  => 'boolean',
        ];
    }

    public function defaultIngredients(): BelongsToMany
    {
        return $this->belongsToMany(PizzaIngredient::class, 'pizza_default_ingredients');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
