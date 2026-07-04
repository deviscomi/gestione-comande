<?php

namespace Database\Seeders;

use App\Models\ServiceSchedule;
use Illuminate\Database\Seeder;

class ServiceScheduleSeeder extends Seeder
{
    public function run(): void
    {
        // Tutti i reparti (cucina, pizzeria, bar) aperti tutti i giorni nel demo.
        // Idempotente su [department, day_of_week].
        foreach (['cucina', 'pizzeria', 'bar'] as $department) {
            for ($day = 0; $day <= 6; $day++) {
                ServiceSchedule::updateOrCreate(
                    ['department' => $department, 'day_of_week' => $day],
                    ['is_active' => true]
                );
            }
        }
    }
}
