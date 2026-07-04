<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            ModuleSeeder::class,
            UserSeeder::class,
            ZoneSeeder::class,
            TableSeeder::class,
            CategorySeeder::class,
            DishVariantGroupSeeder::class, // gruppi varianti: prima dei piatti/vini che li associano
            PizzaVariantSeeder::class,
            PizzaSeeder::class,
            DishSeeder::class,             // Menu Cucina + Vini della casa
            BarSeeder::class,              // Menu Bar (Caffetteria, Cocktail, Bevande, Dessert, Amari)
            WineQuantitySeeder::class,
            WineSeeder::class,             // Carta dei Vini (bottiglie)
            ServiceScheduleSeeder::class,
            FiscalDeviceSeeder::class,     // Registratore RT demo (modulo fiscal attivo)
            SystemSettingsSeeder::class,
        ]);
    }
}
