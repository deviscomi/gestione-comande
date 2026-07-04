<?php

namespace Database\Seeders;

use App\Models\PizzaVariant;
use Illuminate\Database\Seeder;

class PizzaVariantSeeder extends Seeder
{
    public function run(): void
    {
        PizzaVariant::insert([
            ['name' => 'Impasto ai Cereali', 'code' => 'CERE',     'price_add' => 1.50, 'is_active' => true],
            ['name' => 'Doppio Impasto',     'code' => 'DOPP',     'price_add' => 1.00, 'is_active' => true],
            ['name' => 'No Lattosio',        'code' => 'NO LATT.', 'price_add' => 1.00, 'is_active' => true],
        ]);
    }
}
