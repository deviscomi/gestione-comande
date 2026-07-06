<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Pizza;
use App\Models\PizzaIngredient;
use Illuminate\Database\Seeder;

class PizzaSeeder extends Seeder
{
    public function run(): void
    {
        // Categoria pizzeria di default: le pizze seedate devono avere una
        // categoria (il tablet filtra per chip categoria).
        $category = Category::firstOrCreate(
            ['name' => 'Pizze', 'department' => 'pizzeria'],
            ['sort_order' => 5, 'is_active' => true]
        );

        // ── Archivio ingredienti pizza ─────────────────────────────────────
        // firstOrCreate evita duplicati se il seeder viene rieseguito
        $ingNames = [
            ['name' => 'Pomodoro',         'price_add' => 0.00, 'price_remove' => 0.00],
            ['name' => 'Mozzarella',       'price_add' => 1.50, 'price_remove' => 0.80],
            ['name' => 'Prosciutto cotto', 'price_add' => 1.50, 'price_remove' => 0.80],
            ['name' => 'Prosciutto crudo', 'price_add' => 2.00, 'price_remove' => 0.80],
            ['name' => 'Salame piccante',  'price_add' => 1.50, 'price_remove' => 0.80],
            ['name' => 'Funghi',           'price_add' => 1.00, 'price_remove' => 0.60],
            ['name' => 'Olive',            'price_add' => 0.80, 'price_remove' => 0.50],
            ['name' => 'Cipolla',          'price_add' => 0.60, 'price_remove' => 0.40],
            ['name' => 'Peperoni',         'price_add' => 0.80, 'price_remove' => 0.50],
            ['name' => 'Tonno',            'price_add' => 1.50, 'price_remove' => 0.80],
            ['name' => 'Acciughe',         'price_add' => 1.00, 'price_remove' => 0.60],
            ['name' => 'Wurstel',          'price_add' => 1.00, 'price_remove' => 0.60],
            ['name' => 'Gorgonzola',       'price_add' => 1.50, 'price_remove' => 0.80],
            ['name' => 'Speck',            'price_add' => 2.00, 'price_remove' => 0.80],
            ['name' => 'Rucola',           'price_add' => 0.80, 'price_remove' => 0.50],
            ['name' => 'Porcini',          'price_add' => 2.00, 'price_remove' => 0.80],
        ];

        $ings = [];
        foreach ($ingNames as $data) {
            $ing = PizzaIngredient::firstOrCreate(
                ['name' => $data['name']],
                ['price_add' => $data['price_add'], 'price_remove' => $data['price_remove'], 'is_active' => true]
            );
            $ings[$ing->name] = $ing->id;
        }

        // ── Pizze ──────────────────────────────────────────────────────────
        $pizzas = [
            ['name' => 'Margherita',        'base_price' => 7.50, 'description' => 'La classica',
             'defaults' => ['Pomodoro', 'Mozzarella']],

            ['name' => 'Marinara',          'base_price' => 6.50, 'description' => null,
             'defaults' => ['Pomodoro']],

            ['name' => 'Prosciutto e Funghi','base_price' => 9.00, 'description' => null,
             'defaults' => ['Pomodoro', 'Mozzarella', 'Prosciutto cotto', 'Funghi']],

            ['name' => 'Diavola',           'base_price' => 9.00, 'description' => null,
             'defaults' => ['Pomodoro', 'Mozzarella', 'Salame piccante']],

            ['name' => 'Capricciosa',       'base_price' => 10.00, 'description' => null,
             'defaults' => ['Pomodoro', 'Mozzarella', 'Prosciutto cotto', 'Funghi', 'Olive']],

            ['name' => 'Quattro Stagioni',  'base_price' => 10.50, 'description' => null,
             'defaults' => ['Pomodoro', 'Mozzarella', 'Prosciutto cotto', 'Funghi', 'Olive', 'Cipolla']],

            ['name' => 'Tonno e Cipolla',   'base_price' => 9.50, 'description' => null,
             'defaults' => ['Pomodoro', 'Mozzarella', 'Tonno', 'Cipolla']],

            ['name' => 'Calzone',           'base_price' => 9.50, 'description' => 'Ripiena',
             'defaults' => ['Pomodoro', 'Mozzarella', 'Prosciutto cotto']],

            ['name' => 'Bufalina',          'base_price' => 11.00, 'description' => null,
             'defaults' => ['Pomodoro', 'Mozzarella', 'Rucola']],

            ['name' => 'Boscaiola',         'base_price' => 11.50, 'description' => null,
             'defaults' => ['Pomodoro', 'Mozzarella', 'Porcini', 'Speck']],
        ];

        foreach ($pizzas as $p) {
            $pizza = Pizza::firstOrCreate(
                ['name' => $p['name']],
                ['category_id' => $category->id, 'description' => $p['description'], 'base_price' => $p['base_price'], 'is_active' => true]
            );

            // Assegna ingredienti default (sync idempotente)
            $defaultIds = array_map(fn($n) => $ings[$n], $p['defaults']);
            $pizza->defaultIngredients()->sync($defaultIds);
        }
    }
}
