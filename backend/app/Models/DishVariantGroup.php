<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DishVariantGroup extends Model
{
    protected $fillable = ['name', 'department', 'is_required', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'is_active'   => 'boolean',
        ];
    }

    public function options(): HasMany
    {
        return $this->hasMany(DishVariantOption::class);
    }

    public function dishes(): BelongsToMany
    {
        return $this->belongsToMany(Dish::class, 'dish_variant_group_dish');
    }

    public function wines(): BelongsToMany
    {
        return $this->belongsToMany(Wine::class, 'wine_variant_group_wine');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
