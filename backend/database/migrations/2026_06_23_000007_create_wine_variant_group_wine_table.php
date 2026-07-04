<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wine_variant_group_wine', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wine_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dish_variant_group_id')->constrained()->cascadeOnDelete();
            $table->unique(['wine_id', 'dish_variant_group_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wine_variant_group_wine');
    }
};
