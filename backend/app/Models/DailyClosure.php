<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyClosure extends Model
{
    public $timestamps = false;

    protected $fillable = ['closed_by', 'closed_at', 'report_pdf_path', 'is_locked', 'notes'];

    protected function casts(): array
    {
        return [
            'closed_at' => 'datetime',
            'is_locked' => 'boolean',
        ];
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by')->withTrashed();
    }
}
