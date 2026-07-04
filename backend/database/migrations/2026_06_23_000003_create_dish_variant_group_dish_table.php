<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dish_variant_group_dish', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dish_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dish_variant_group_id')->constrained()->cascadeOnDelete();
            $table->unique(['dish_id', 'dish_variant_group_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dish_variant_group_dish');
    }
};
