<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = ['name', 'is_outdoor', 'is_enabled', 'sort_order'];

    protected function casts(): array
    {
        return [
            'is_outdoor' => 'boolean',
            'is_enabled' => 'boolean',
        ];
    }

    public function tables(): HasMany
    {
        return $this->hasMany(Table::class);
    }

    public function scopeEnabled($q)
    {
        return $q->where('is_enabled', true);
    }
}
