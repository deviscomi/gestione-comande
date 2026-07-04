<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\DishVariantGroup;
use App\Models\Wine;
use Illuminate\Database\Seeder;

/**
 * Carta dei Vini (bottiglie) — categorie Rosso/Rosato/Bianco (department carta_vini,
 * create dalla migration seed_wine_categories). 3 vini per categoria, completi di
 * produttore/annata e della variante "Temperatura di servizio" (department vini).
 */
class WineSeeder extends Seeder
{
    public function run(): void
    {
        $tempGroup = DishVariantGroup::where('department', 'vini')
            ->where('name', 'Temperatura di servizio')
            ->first();

        $wines = [
            'Rosso' => [
                ['name' => 'Chianti Classico DOCG',       'producer' => 'Castello di Ama',     'vintage_year' => 2020, 'price' => 24.00],
                ['name' => 'Barolo DOCG',                 'producer' => 'Marchesi di Barolo',  'vintage_year' => 2018, 'price' => 38.00],
                ['name' => 'Montepulciano d\'Abruzzo',    'producer' => 'Cantina Zaccagnini',  'vintage_year' => 2021, 'price' => 18.00],
            ],
            'Rosato' => [
                ['name' => 'Cerasuolo d\'Abruzzo',        'producer' => 'Valle Reale',         'vintage_year' => 2022, 'price' => 16.00],
                ['name' => 'Bardolino Chiaretto',         'producer' => 'Zenato',              'vintage_year' => 2022, 'price' => 17.00],
                ['name' => 'Rosato del Salento',          'producer' => 'Leone de Castris',    'vintage_year' => 2021, 'price' => 15.00],
            ],
            'Bianco' => [
                ['name' => 'Vermentino di Sardegna',      'producer' => 'Sella & Mosca',       'vintage_year' => 2022, 'price' => 16.00],
                ['name' => 'Falanghina del Sannio',       'producer' => 'Feudi di San Gregorio','vintage_year' => 2022, 'price' => 18.00],
                ['name' => 'Gewürztraminer Alto Adige',   'producer' => 'Cantina Tramin',      'vintage_year' => 2021, 'price' => 22.00],
            ],
        ];

        foreach ($wines as $categoryName => $items) {
            $category = Category::where('name', $categoryName)
                ->where('department', 'carta_vini')
                ->first();
            if (! $category) {
                continue;
            }

            foreach ($items as $item) {
                $wine = Wine::firstOrCreate(
                    ['name' => $item['name'], 'category_id' => $category->id],
                    [
                        'producer'     => $item['producer'],
                        'vintage_year' => $item['vintage_year'],
                        'price'        => $item['price'],
                        'is_active'    => true,
                    ]
                );

                if ($tempGroup) {
                    $wine->variantGroups()->syncWithoutDetaching([$tempGroup->id]);
                }
            }
        }
    }
}
