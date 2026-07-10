<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    /**
     * Boot dell'app per i test con una rete di sicurezza sul database.
     *
     * Il container definisce DB_DATABASE=gestione_comande come variabile
     * d'ambiente REALE, che scavalca i valori di phpunit.xml (anche con
     * force="true"). Senza questo blocco la suite — che usa RefreshDatabase
     * (→ migrate:fresh) — azzererebbe il DATABASE DI SVILUPPO.
     *
     * Qui forziamo il DB di test (suffisso `_test`) e, se per qualsiasi motivo
     * il target non è un DB di test, interrompiamo prima di qualunque
     * migrazione distruttiva.
     */
    public function createApplication()
    {
        $app = require __DIR__ . '/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();

        $conn = config('database.default');
        $db   = (string) config("database.connections.$conn.database");

        if (! str_ends_with($db, '_test')) {
            $db = $db . '_test';
            config(["database.connections.$conn.database" => $db]);
            DB::purge($conn); // scarta la connessione col vecchio nome DB
        }

        if (! str_ends_with((string) config("database.connections.$conn.database"), '_test')) {
            throw new \RuntimeException(
                "Test interrotti: il database di test deve terminare con '_test' (rilevato: '{$db}'). "
                . 'Interruzione per non azzerare dati reali.'
            );
        }

        return $app;
    }
}
