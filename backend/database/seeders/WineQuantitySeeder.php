<?php

namespace Database\Seeders;

use App\Models\WineQuantity;
use Illuminate\Database\Seeder;

class WineQuantitySeeder extends Seeder
{
    public function run(): void
    {
        // price_add = sovrapprezzo sul prezzo base del vino della casa (calice).
        $quantities = [
            ['name' => 'Calice',      'price_add' => 0.00, 'sort_order' => 1],
            ['name' => 'Quartino',    'price_add' => 2.50, 'sort_order' => 2],
            ['name' => 'Mezzo litro', 'price_add' => 4.50, 'sort_order' => 3],
            ['name' => 'Un litro',    'price_add' => 8.50, 'sort_order' => 4],
        ];

        foreach ($quantities as $q) {
            WineQuantity::updateOrCreate(
                ['name' => $q['name']],
                ['price_add' => $q['price_add'], 'sort_order' => $q['sort_order'], 'is_active' => true]
            );
        }
    }
}
