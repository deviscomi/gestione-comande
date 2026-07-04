<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class License extends Model
{
    protected $table = 'license';

    protected $fillable = [
        'licensee_name',
        'tier',
        'license_key',
        'expires_at',
        'notes',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public static function current(): static
    {
        return static::firstOrCreate(
            ['id' => 1],
            [
                'licensee_name' => 'Ristorante',
                'tier'          => 'base',
            ]
        );
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
