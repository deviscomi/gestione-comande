<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_item_mods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->string('mod_type', 50);
            $table->string('mod_value', 200);
            $table->decimal('price_change', 6, 2)->default(0.00);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_mods');
    }
};
