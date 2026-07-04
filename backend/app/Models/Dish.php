<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Dish extends Model
{
    protected $fillable = ['category_id', 'name', 'description', 'price', 'is_active'];

    protected function casts(): array
    {
        return [
            'price'     => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(Ingredient::class, 'dish_ingredients')
                    ->withPivot('is_default');
    }

    public function defaultIngredients(): BelongsToMany
    {
        return $this->ingredients()->wherePivot('is_default', true);
    }

    public function availableAdditions(): BelongsToMany
    {
        return $this->ingredients()->wherePivot('is_default', false);
    }

    public function variantGroups(): BelongsToMany
    {
        return $this->belongsToMany(DishVariantGroup::class, 'dish_variant_group_dish');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
