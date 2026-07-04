<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE categories MODIFY department ENUM('cucina', 'pizzeria', 'bevande', 'dessert', 'amari', 'vini_casa', 'carta_vini') NOT NULL");

        Schema::create('wine_quantities', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50);
            $table->decimal('price_add', 8, 2)->default(0.00);
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wine_quantities');

        DB::statement("ALTER TABLE categories MODIFY department ENUM('cucina', 'pizzeria', 'bevande', 'dessert', 'amari') NOT NULL");
    }
};
