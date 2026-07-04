<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceSchedule extends Model
{
    protected $table = 'service_schedule';

    public $timestamps = false;

    protected $fillable = ['department', 'day_of_week', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /**
     * Giorno della settimana corrente in formato DB (0=Lun ... 6=Dom).
     * PHP usa 0=Dom, quindi adattiamo.
     */
    public static function currentDayOfWeek(): int
    {
        $phpDow = (int) now()->format('w'); // 0=Dom
        return $phpDow === 0 ? 6 : $phpDow - 1; // 0=Lun ... 6=Dom
    }

    /**
     * Indica se un reparto è operativo oggi.
     * Default: aperto se non esiste una riga di configurazione.
     */
    public static function isDepartmentActiveToday(string $department): bool
    {
        $active = static::where('department', $department)
            ->where('day_of_week', static::currentDayOfWeek())
            ->value('is_active');

        return $active === null ? true : (bool) $active;
    }
}
