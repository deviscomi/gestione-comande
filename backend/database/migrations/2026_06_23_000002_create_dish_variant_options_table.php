<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dish_variant_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dish_variant_group_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->decimal('price_add', 8, 2)->default(0.00);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dish_variant_options');
    }
};
