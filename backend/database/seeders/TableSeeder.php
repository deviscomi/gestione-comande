<?php

namespace Database\Seeders;

use App\Models\Table;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class TableSeeder extends Seeder
{
    public function run(): void
    {
        // Tavoli demo per zona (in produzione si configurano da UI admin / ZoneManager).
        // Numerazione globale per chiarezza; tutti 'libero'. Idempotente su [zone_id, number, suffix].
        $layout = [
            'Sala Interna' => range(1, 12),
            'Veranda'      => range(13, 20),
            'Giardino'     => range(21, 28),
        ];

        foreach ($layout as $zoneName => $numbers) {
            $zone = Zone::where('name', $zoneName)->first();
            if (! $zone) {
                continue;
            }

            foreach ($numbers as $number) {
                Table::firstOrCreate(
                    ['zone_id' => $zone->id, 'number' => $number, 'suffix' => null],
                    ['status' => 'libero']
                );
            }
        }

        // Esempio di tavolo "bis" (sdoppiamento) per mostrare la funzione suffix.
        $sala = Zone::where('name', 'Sala Interna')->first();
        if ($sala) {
            Table::firstOrCreate(
                ['zone_id' => $sala->id, 'number' => 5, 'suffix' => 'bis'],
                ['status' => 'libero']
            );
        }
    }
}
