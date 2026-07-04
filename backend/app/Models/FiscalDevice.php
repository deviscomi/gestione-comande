<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiscalDevice extends Model
{
    protected $fillable = [
        'name',
        'driver',
        'connection_type',
        'ip_address',
        'port',
        'base_url',
        'auth_token',
        'fiscal_serial_number',
        'vat_number',
        'is_active',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_active'  => 'boolean',
            'auth_token' => 'encrypted',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function fiscalReceipts(): HasMany
    {
        return $this->hasMany(FiscalReceipt::class);
    }
}
