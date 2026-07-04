<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // L'enum esistente non includeva ancora 'bar' (gap pre-esistente rispetto a printers.department) —
        // lo aggiungiamo insieme a 'scontrino_parziale' per allineare print_jobs alle stampe già dispatchate.
        DB::statement("ALTER TABLE print_jobs MODIFY COLUMN print_type ENUM('cassiere','cucina','pizzeria','pre_conto','bar','scontrino_parziale') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE print_jobs MODIFY COLUMN print_type ENUM('cassiere','cucina','pizzeria','pre_conto') NOT NULL");
    }
};
