<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Module extends Model
{
    public $timestamps = false;
    const UPDATED_AT = 'updated_at';

    protected $fillable = ['slug', 'name', 'description', 'is_active', 'sort_order'];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Verifica se un modulo è attivo. Delega all'unico punto di verità
     * (LicenseService::isActive), che gestisce il caso 'core' e la cache.
     */
    public static function isEnabled(string $slug): bool
    {
        return app(\App\Services\LicenseService::class)->isActive($slug);
    }
}
