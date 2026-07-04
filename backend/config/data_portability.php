<?php

// Registro centrale dei gruppi di dati esportabili/importabili dal backoffice.
// Guida DataExportService e DataImportService — NON contenere closures qui
// (il file deve restare compatibile con `php artisan config:cache`).

return [

    'schema_version' => 1,

    'groups' => [
        'impostazioni' => [
            'label'     => 'Impostazioni di sistema',
            'sensitive' => false,
        ],
        'menu_cucina' => [
            'label'     => 'Menu cucina',
            'sensitive' => false,
        ],
        'menu_pizzeria' => [
            'label'     => 'Menu pizzeria',
            'sensitive' => false,
        ],
        'menu_vini' => [
            'label'     => 'Menu vini',
            'sensitive' => false,
        ],
        'sala' => [
            'label'     => 'Sala (zone e tavoli)',
            'sensitive' => false,
        ],
        'stampanti' => [
            'label'     => 'Stampanti',
            'sensitive' => false,
        ],
        'utenti' => [
            'label'     => 'Utenti',
            'sensitive' => true,
        ],
    ],

    // Ordine di applicazione dei gruppi in import (rispetta le dipendenze FK
    // tra le entità di ciascun gruppo, vedi DataImportService::GROUP_ORDER)
    'group_order' => [
        'impostazioni',
        'menu_cucina',
        'menu_pizzeria',
        'menu_vini',
        'sala',
        'stampanti',
        'utenti',
    ],

    // Entità "piatte" esportabili/importabili in CSV per modifica massiva
    'csv_entities' => ['dishes', 'pizzas', 'wines'],
];
