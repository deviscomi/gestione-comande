<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Dish;
use App\Models\DishVariantGroup;
use App\Models\Ingredient;
use Illuminate\Database\Seeder;

/**
 * Menu Bar — categorie con department bar/bevande/dessert/amari.
 * Caffetteria e Cocktail (department bar), più Bevande, Dessert, Amari.
 * I cocktail hanno ingredienti (department bar) e variante Ghiaccio; i caffè con latte
 * hanno la variante Tipo di latte. Gruppi varianti creati da DishVariantGroupSeeder.
 */
class BarSeeder extends Seeder
{
    public function run(): void
    {
        // ── Archivio ingredienti bar (per i cocktail) ─────────────────────────
        $ingredientArchive = [
            'Aperol', 'Prosecco', 'Soda', 'Gin', 'Bitter Campari', 'Vermouth rosso',
            'Rum bianco', 'Menta', 'Lime', 'Zucchero di canna', 'Vodka', 'Succo di pomodoro',
        ];

        $ing = [];
        foreach ($ingredientArchive as $name) {
            $ing[$name] = Ingredient::firstOrCreate(
                ['name' => $name],
                ['department' => 'bar', 'price_add' => 0.00, 'price_remove' => 0.00, 'is_active' => true]
            )->id;
        }

        // Gruppi varianti bar (creati da DishVariantGroupSeeder)
        $variantGroup = DishVariantGroup::where('department', 'bar')->pluck('id', 'name');

        // ── Articoli per categoria ────────────────────────────────────────────
        // categoria => [name, department, [items...]]
        // item: name, price, [defaults], [variants]
        $menu = [
            ['name' => 'Caffetteria', 'department' => 'bar', 'items' => [
                ['name' => 'Caffè Espresso',  'price' => 1.20, 'defaults' => [], 'variants' => []],
                ['name' => 'Cappuccino',      'price' => 1.60, 'defaults' => [], 'variants' => ['Tipo di latte']],
                ['name' => 'Caffè Macchiato', 'price' => 1.30, 'defaults' => [], 'variants' => ['Tipo di latte']],
                ['name' => 'Caffè Corretto',  'price' => 2.00, 'defaults' => [], 'variants' => []],
            ]],
            ['name' => 'Cocktail', 'department' => 'bar', 'items' => [
                ['name' => 'Spritz Aperol', 'price' => 6.00, 'defaults' => ['Aperol', 'Prosecco', 'Soda'],                      'variants' => ['Ghiaccio']],
                ['name' => 'Negroni',       'price' => 7.00, 'defaults' => ['Gin', 'Bitter Campari', 'Vermouth rosso'],         'variants' => ['Ghiaccio']],
                ['name' => 'Mojito',        'price' => 7.00, 'defaults' => ['Rum bianco', 'Menta', 'Lime', 'Zucchero di canna', 'Soda'], 'variants' => ['Ghiaccio']],
                ['name' => 'Bloody Mary',   'price' => 7.50, 'defaults' => ['Vodka', 'Succo di pomodoro', 'Lime'],              'variants' => ['Ghiaccio']],
            ]],
            ['name' => 'Bevande', 'department' => 'bevande', 'items' => [
                ['name' => 'Acqua Naturale 0,5L',  'price' => 1.50, 'defaults' => [], 'variants' => []],
                ['name' => 'Acqua Frizzante 0,5L', 'price' => 1.50, 'defaults' => [], 'variants' => []],
                ['name' => 'Coca-Cola 33cl',       'price' => 3.00, 'defaults' => [], 'variants' => []],
                ['name' => 'Aranciata 33cl',       'price' => 3.00, 'defaults' => [], 'variants' => []],
                ['name' => 'Birra Chiara 0,4L',    'price' => 4.50, 'defaults' => [], 'variants' => []],
            ]],
            ['name' => 'Dessert', 'department' => 'dessert', 'items' => [
                ['name' => 'Tiramisù',              'price' => 5.00, 'defaults' => [], 'variants' => []],
                ['name' => 'Panna Cotta',           'price' => 4.50, 'defaults' => [], 'variants' => []],
                ['name' => 'Tortino al Cioccolato', 'price' => 6.00, 'defaults' => [], 'variants' => []],
                ['name' => 'Cheesecake ai Frutti di Bosco', 'price' => 5.50, 'defaults' => [], 'variants' => []],
            ]],
            ['name' => 'Amari', 'department' => 'amari', 'items' => [
                ['name' => 'Amaro del Capo',  'price' => 4.00, 'defaults' => [], 'variants' => []],
                ['name' => 'Limoncello',      'price' => 4.00, 'defaults' => [], 'variants' => []],
                ['name' => 'Grappa Barricata','price' => 5.00, 'defaults' => [], 'variants' => []],
                ['name' => 'Sambuca',         'price' => 4.00, 'defaults' => [], 'variants' => []],
            ]],
        ];

        foreach ($menu as $cat) {
            $category = Category::where('name', $cat['name'])
                ->where('department', $cat['department'])
                ->first();
            if (! $category) {
                continue;
            }

            foreach ($cat['items'] as $item) {
                $dish = Dish::firstOrCreate(
                    ['name' => $item['name'], 'category_id' => $category->id],
                    ['description' => null, 'price' => $item['price'], 'is_active' => true]
                );

                if (! empty($item['defaults'])) {
                    $sync = [];
                    foreach ($item['defaults'] as $n) {
                        if (isset($ing[$n])) $sync[$ing[$n]] = ['is_default' => true];
                    }
                    if ($sync) {
                        $dish->ingredients()->sync($sync);
                    }
                }

                $groupIds = collect($item['variants'])
                    ->map(fn ($name) => $variantGroup[$name] ?? null)
                    ->filter()
                    ->all();
                if ($groupIds) {
                    $dish->variantGroups()->sync($groupIds);
                }
            }
        }
    }
}
