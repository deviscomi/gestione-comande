<?php

namespace Database\Seeders;

use App\Models\Zone;
use Illuminate\Database\Seeder;

class ZoneSeeder extends Seeder
{
    public function run(): void
    {
        // Zone demo (in produzione si configurano da UI admin). Idempotente su 'name'.
        $zones = [
            ['name' => 'Sala Interna', 'is_outdoor' => false, 'sort_order' => 1],
            ['name' => 'Veranda',      'is_outdoor' => true,  'sort_order' => 2],
            ['name' => 'Giardino',     'is_outdoor' => true,  'sort_order' => 3],
        ];

        foreach ($zones as $zone) {
            Zone::firstOrCreate(
                ['name' => $zone['name']],
                ['is_outdoor' => $zone['is_outdoor'], 'is_enabled' => true, 'sort_order' => $zone['sort_order']]
            );
        }
    }
}
