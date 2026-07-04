<?php

namespace App\Traits;

use App\Models\ActivityLog;

trait LogsActivity
{
    protected function logActivity(string $action, string $description, $entity = null): void
    {
        ActivityLog::create([
            'user_id'     => auth()->id(),
            'action'      => $action,
            'description' => $description,
            'entity_type' => $entity ? class_basename($entity) : null,
            'entity_id'   => $entity?->id,
            'ip_address'  => request()->ip(),
            // Scrive il timestamp in ora locale (app tz) come tutte le altre tabelle,
            // invece di lasciare il default UTC del DB → evita lo sfasamento di fuso orario.
            'created_at'  => now(),
        ]);
    }
}
