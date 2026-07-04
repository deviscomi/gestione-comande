<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE print_jobs MODIFY COLUMN print_type ENUM('cassiere','cucina','pizzeria','pre_conto') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE print_jobs MODIFY COLUMN print_type ENUM('cassiere','cucina','pizzeria') NOT NULL");
    }
};
