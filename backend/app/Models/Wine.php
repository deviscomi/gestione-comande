<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Wine extends Model
{
    protected $fillable = ['category_id', 'name', 'producer', 'vintage_year', 'price', 'description', 'is_active'];

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

    public function variantGroups(): BelongsToMany
    {
        return $this->belongsToMany(DishVariantGroup::class, 'wine_variant_group_wine');
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
