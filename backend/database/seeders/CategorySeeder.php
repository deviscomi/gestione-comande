<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        // NB: le categorie "Carta dei Vini" (Rosso/Rosato/Bianco, department carta_vini)
        // sono create dalla migration 2026_06_21_000002_seed_wine_categories e popolate
        // dal WineSeeder — qui non vanno duplicate.
        $categories = [
            // ── Cucina ──
            ['name' => 'Antipasti',       'department' => 'cucina',    'sort_order' => 1],
            ['name' => 'Primi',           'department' => 'cucina',    'sort_order' => 2],
            ['name' => 'Secondi',         'department' => 'cucina',    'sort_order' => 3],
            ['name' => 'Contorni',        'department' => 'cucina',    'sort_order' => 4],
            // ── Pizzeria ──
            ['name' => 'Pizze',           'department' => 'pizzeria',  'sort_order' => 5],
            // ── Bar ──
            ['name' => 'Caffetteria',     'department' => 'bar',       'sort_order' => 6],
            ['name' => 'Cocktail',        'department' => 'bar',       'sort_order' => 7],
            ['name' => 'Bevande',         'department' => 'bevande',   'sort_order' => 8],
            ['name' => 'Dessert',         'department' => 'dessert',   'sort_order' => 9],
            ['name' => 'Amari',           'department' => 'amari',     'sort_order' => 10],
            // ── Vini ──
            ['name' => 'Vini della casa', 'department' => 'vini_casa', 'sort_order' => 11],
        ];

        foreach ($categories as $cat) {
            Category::firstOrCreate(
                ['name' => $cat['name'], 'department' => $cat['department']],
                ['sort_order' => $cat['sort_order'], 'is_active' => true]
            );
        }
    }
}
