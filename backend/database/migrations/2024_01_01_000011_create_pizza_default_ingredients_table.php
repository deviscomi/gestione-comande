<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pizza_default_ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pizza_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pizza_ingredient_id')
                  ->constrained('pizza_ingredients')->restrictOnDelete();
            $table->unique(['pizza_id', 'pizza_ingredient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pizza_default_ingredients');
    }
};
