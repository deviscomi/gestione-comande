<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Ingredient extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'department', 'ingredient_category_id', 'price_add', 'price_remove', 'is_active'];

    protected function casts(): array
    {
        return [
            'price_add'    => 'decimal:2',
            'price_remove' => 'decimal:2',
            'is_active'    => 'boolean',
        ];
    }

    public function dishes(): BelongsToMany
    {
        return $this->belongsToMany(Dish::class, 'dish_ingredients')
                    ->withPivot('is_default');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(IngredientCategory::class, 'ingredient_category_id');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
