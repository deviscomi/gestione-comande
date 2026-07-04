<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Dish;
use App\Models\DishVariantGroup;
use App\Models\Ingredient;
use Illuminate\Database\Seeder;

/**
 * Menu Cucina (Antipasti, Primi, Secondi, Contorni) + Vini della casa.
 * Ogni piatto è completo di ingredienti (default rimovibili + aggiunte facoltative)
 * e, dove ha senso, di gruppi varianti (Cottura, Porzione — creati da DishVariantGroupSeeder).
 */
class DishSeeder extends Seeder
{
    public function run(): void
    {
        // ── Archivio ingredienti cucina ───────────────────────────────────────
        // [price_add, price_remove] — gli "add" valorizzati sono le aggiunte a pagamento.
        $ingredientArchive = [
            'Glutine'        => [0.00, 0.00],
            'Lattosio'       => [0.00, 0.00],
            'Parmigiano'     => [1.50, 0.00],
            'Pecorino'       => [1.20, 0.00],
            'Gorgonzola'     => [1.50, 0.00],
            'Rucola'         => [0.50, 0.00],
            'Peperoncino'    => [0.00, 0.00],
            'Pomodoro fresco'=> [0.00, 0.00],
            'Basilico'       => [0.00, 0.00],
            'Aglio'          => [0.00, 0.00],
            'Salumi misti'   => [0.00, 0.00],
            'Manzo'          => [0.00, 0.00],
            'Guanciale'      => [0.00, 0.00],
            'Uova'           => [0.00, 0.00],
            'Pepe nero'      => [0.00, 0.00],
            'Funghi porcini' => [0.00, 0.00],
            'Patate'         => [0.00, 0.00],
            'Pomodorini'     => [0.00, 0.00],
            'Lattuga'        => [0.00, 0.00],
            'Carote'         => [0.00, 0.00],
            'Rosmarino'      => [0.00, 0.00],
            'Zucchine'       => [0.00, 0.00],
            'Melanzane'      => [0.00, 0.00],
            'Peperoni'       => [0.00, 0.00],
        ];

        $ing = [];
        foreach ($ingredientArchive as $name => [$add, $remove]) {
            $ing[$name] = Ingredient::firstOrCreate(
                ['name' => $name],
                ['department' => 'cucina', 'price_add' => $add, 'price_remove' => $remove, 'is_active' => true]
            )->id;
        }

        // Gruppi varianti cucina (creati da DishVariantGroupSeeder)
        $variantGroup = DishVariantGroup::where('department', 'cucina')
            ->pluck('id', 'name'); // ['Cottura' => id, 'Porzione' => id]

        // ── Piatti cucina ─────────────────────────────────────────────────────
        // defaults  = ingredienti inclusi (rimovibili)
        // additions = aggiunte facoltative a pagamento
        // variants  = nomi dei gruppi varianti da associare
        $dishes = [
            'Antipasti' => [
                ['name' => 'Bruschetta al Pomodoro',   'description' => 'Pane tostato con pomodoro fresco, basilico e olio EVO', 'price' => 5.00,
                 'defaults' => ['Glutine', 'Pomodoro fresco', 'Basilico', 'Aglio'], 'additions' => ['Parmigiano']],
                ['name' => 'Tagliere di Salumi Misti', 'description' => 'Selezione di salumi artigianali con giardiniera', 'price' => 12.00,
                 'defaults' => ['Salumi misti'], 'additions' => []],
                ['name' => 'Carpaccio di Manzo',       'description' => 'Fettine di manzo crudo con rucola e parmigiano', 'price' => 13.00,
                 'defaults' => ['Manzo', 'Rucola', 'Parmigiano'], 'additions' => []],
            ],
            'Primi' => [
                ['name' => 'Spaghetti alla Carbonara',  'description' => 'Spaghetti con guanciale, pecorino, uova e pepe nero', 'price' => 12.00,
                 'defaults' => ['Glutine', 'Guanciale', 'Pecorino', 'Uova', 'Pepe nero'], 'additions' => ['Parmigiano']],
                ['name' => 'Penne all\'Arrabbiata',     'description' => 'Penne con salsa di pomodoro piccante e aglio', 'price' => 10.00,
                 'defaults' => ['Glutine', 'Pomodoro fresco', 'Aglio', 'Peperoncino'], 'additions' => ['Parmigiano', 'Pecorino']],
                ['name' => 'Risotto ai Funghi Porcini', 'description' => 'Risotto mantecato con porcini freschi e parmigiano', 'price' => 14.00,
                 'defaults' => ['Funghi porcini', 'Parmigiano'], 'additions' => ['Pecorino']],
            ],
            'Secondi' => [
                ['name' => 'Tagliata di Manzo',       'description' => 'Controfiletto alla griglia con rucola e scaglie di parmigiano', 'price' => 22.00,
                 'defaults' => ['Manzo', 'Rucola', 'Parmigiano'], 'additions' => [], 'variants' => ['Cottura', 'Porzione']],
                ['name' => 'Branzino al Forno',       'description' => 'Branzino intero al forno con patate e pomodorini', 'price' => 20.00,
                 'defaults' => ['Patate', 'Pomodorini'], 'additions' => [], 'variants' => ['Porzione']],
                ['name' => 'Cotoletta alla Milanese', 'description' => 'Costoletta di vitello impanata e fritta nel burro', 'price' => 18.00,
                 'defaults' => ['Glutine'], 'additions' => [], 'variants' => ['Cottura', 'Porzione']],
            ],
            'Contorni' => [
                ['name' => 'Patate al Forno',   'description' => 'Patate croccanti con rosmarino e aglio', 'price' => 5.00,
                 'defaults' => ['Patate', 'Rosmarino', 'Aglio'], 'additions' => []],
                ['name' => 'Insalata Mista',    'description' => 'Lattuga, rucola, pomodorini e carote', 'price' => 4.00,
                 'defaults' => ['Lattuga', 'Rucola', 'Pomodorini', 'Carote'], 'additions' => []],
                ['name' => 'Verdure Grigliate', 'description' => 'Zucchine, melanzane e peperoni alla griglia', 'price' => 6.00,
                 'defaults' => ['Zucchine', 'Melanzane', 'Peperoni'], 'additions' => []],
            ],
            // Vini della casa: prezzo = calice (base). I formati maggiori sommano il sovrapprezzo (WineQuantity).
            'Vini della casa' => [
                ['name' => 'Vino Rosso',  'description' => 'Vino rosso della casa',  'price' => 4.00, 'defaults' => [], 'additions' => []],
                ['name' => 'Vino Rosato', 'description' => 'Vino rosato della casa', 'price' => 4.00, 'defaults' => [], 'additions' => []],
                ['name' => 'Vino Bianco', 'description' => 'Vino bianco della casa', 'price' => 4.50, 'defaults' => [], 'additions' => []],
            ],
        ];

        foreach ($dishes as $categoryName => $items) {
            $category = Category::where('name', $categoryName)->first();
            if (! $category) {
                continue;
            }

            foreach ($items as $item) {
                $dish = Dish::firstOrCreate(
                    ['name' => $item['name'], 'category_id' => $category->id],
                    ['description' => $item['description'], 'price' => $item['price'], 'is_active' => true]
                );

                // Ingredienti: default (is_default=true) + aggiunte facoltative (is_default=false)
                $sync = [];
                foreach ($item['defaults'] as $n) {
                    if (isset($ing[$n])) $sync[$ing[$n]] = ['is_default' => true];
                }
                foreach ($item['additions'] as $n) {
                    if (isset($ing[$n])) $sync[$ing[$n]] = ['is_default' => false];
                }
                if ($sync) {
                    $dish->ingredients()->sync($sync);
                }

                // Gruppi varianti
                $groupIds = collect($item['variants'] ?? [])
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
