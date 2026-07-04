<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE categories MODIFY department ENUM('cucina', 'pizzeria', 'bevande', 'dessert', 'amari', 'vini_casa', 'carta_vini', 'bar') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE categories MODIFY department ENUM('cucina', 'pizzeria', 'bevande', 'dessert', 'amari', 'vini_casa', 'carta_vini') NOT NULL");
    }
};
