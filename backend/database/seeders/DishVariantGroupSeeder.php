<?php

namespace Database\Seeders;

use App\Models\DishVariantGroup;
use App\Models\DishVariantOption;
use Illuminate\Database\Seeder;

/**
 * Gruppi di varianti (scelte mutuamente esclusive) per piatti e vini.
 * L'associazione gruppo→piatto avviene in DishSeeder/BarSeeder, gruppo→vino in WineSeeder.
 * department: cucina | bar | pizzeria | vini
 */
class DishVariantGroupSeeder extends Seeder
{
    public function run(): void
    {
        $groups = [
            // ── Cucina ──
            [
                'name' => 'Cottura', 'department' => 'cucina', 'is_required' => true, 'sort_order' => 1,
                'options' => [
                    ['name' => 'Al sangue',    'price_add' => 0.00],
                    ['name' => 'Media',        'price_add' => 0.00],
                    ['name' => 'Ben cotta',    'price_add' => 0.00],
                ],
            ],
            [
                'name' => 'Porzione', 'department' => 'cucina', 'is_required' => false, 'sort_order' => 2,
                'options' => [
                    ['name' => 'Normale',      'price_add' => 0.00],
                    ['name' => 'Abbondante',   'price_add' => 3.00],
                ],
            ],
            // ── Bar ──
            [
                'name' => 'Tipo di latte', 'department' => 'bar', 'is_required' => false, 'sort_order' => 1,
                'options' => [
                    ['name' => 'Intero',              'price_add' => 0.00],
                    ['name' => 'Parzialmente scremato','price_add' => 0.00],
                    ['name' => 'Soia',                'price_add' => 0.50],
                    ['name' => 'Avena',               'price_add' => 0.50],
                ],
            ],
            [
                'name' => 'Ghiaccio', 'department' => 'bar', 'is_required' => false, 'sort_order' => 2,
                'options' => [
                    ['name' => 'Con ghiaccio',   'price_add' => 0.00],
                    ['name' => 'Senza ghiaccio', 'price_add' => 0.00],
                ],
            ],
            // ── Vini ──
            [
                'name' => 'Temperatura di servizio', 'department' => 'vini', 'is_required' => false, 'sort_order' => 1,
                'options' => [
                    ['name' => 'Cantina (12-14°C)', 'price_add' => 0.00],
                    ['name' => 'Ambiente',          'price_add' => 0.00],
                    ['name' => 'Fresco (8°C)',      'price_add' => 0.00],
                ],
            ],
        ];

        foreach ($groups as $g) {
            $group = DishVariantGroup::firstOrCreate(
                ['name' => $g['name'], 'department' => $g['department']],
                ['is_required' => $g['is_required'], 'is_active' => true, 'sort_order' => $g['sort_order']]
            );

            foreach ($g['options'] as $i => $opt) {
                DishVariantOption::firstOrCreate(
                    ['dish_variant_group_id' => $group->id, 'name' => $opt['name']],
                    ['price_add' => $opt['price_add'], 'is_active' => true, 'sort_order' => $i + 1]
                );
            }
        }
    }
}
