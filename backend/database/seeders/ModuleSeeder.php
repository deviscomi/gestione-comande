<?php

namespace Database\Seeders;

use App\Models\License;
use App\Models\Module;
use Illuminate\Database\Seeder;

class ModuleSeeder extends Seeder
{
    public function run(): void
    {
        if (Module::count() === 0) {
            Module::insert([
                ['slug' => 'core',                'name' => 'Core',                 'description' => 'Tavoli, ordini, menu base. Sempre attivo.',                    'is_active' => true,  'sort_order' => 1],
                ['slug' => 'printing',            'name' => 'Stampa ESC/POS',       'description' => 'Stampa termica su rete LAN via ESC/POS.',                      'is_active' => true,  'sort_order' => 2],
                ['slug' => 'pizzeria',            'name' => 'Modulo Pizzeria',      'description' => 'Varianti pizza (CERE/DOPP/NO LATT.), ingredienti, categorie.', 'is_active' => true,  'sort_order' => 3],
                ['slug' => 'reports',             'name' => 'Report',               'description' => 'Report giornalieri PDF e statistiche avanzate.',               'is_active' => true,  'sort_order' => 4],
                ['slug' => 'daily_closure',       'name' => 'Chiusura Giornaliera', 'description' => 'Workflow di chiusura fine giornata con PDF di riepilogo.',     'is_active' => true,  'sort_order' => 5],
                ['slug' => 'advanced_backoffice', 'name' => 'Backoffice Avanzato',  'description' => 'Gestione utenti, log attività, impostazioni di sistema.',      'is_active' => true,  'sort_order' => 6],
                ['slug' => 'outdoor_tables',      'name' => 'Tavoli Esterni',       'description' => 'Gestione dinamica di zone e tavoli outdoor.',                  'is_active' => true,  'sort_order' => 7],
                ['slug' => 'fiscal',              'name' => 'Scontrini Fiscali',    'description' => 'Emissione scontrini fiscali tramite Registratore Telematico.', 'is_active' => true,  'sort_order' => 8],
            ]);
        }

        // Demo: assicura che i moduli Tavoli Esterni e Scontrini Fiscali siano attivi
        // anche su un DB già esistente (dove l'insert sopra viene saltato).
        Module::whereIn('slug', ['outdoor_tables', 'fiscal'])->update(['is_active' => true]);

        if (License::count() === 0) {
            License::create([
                'id'             => 1,
                'licensee_name'  => 'Ristorante Demo',
                'tier'           => 'base',
                'license_key'    => null,
                'expires_at'     => null,
                'notes'          => null,
            ]);
        }
    }
}
