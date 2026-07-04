<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'department', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function dishes(): HasMany
    {
        return $this->hasMany(Dish::class);
    }

    public function wines(): HasMany
    {
        return $this->hasMany(Wine::class);
    }

    public function scopeActive($q)
    {
        return $q->where('is_active', true);
    }
}
