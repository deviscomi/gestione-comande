<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL: ALTER ENUM aggiungendo il nuovo valore senza toccare i dati esistenti
        DB::statement("ALTER TABLE print_jobs MODIFY print_type ENUM('cassiere','cucina','pizzeria','pre_conto') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE print_jobs MODIFY print_type ENUM('cassiere','cucina','pizzeria') NOT NULL");
    }
};
