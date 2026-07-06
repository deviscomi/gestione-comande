<?php

use App\Models\Category;
use App\Models\Pizza;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pizzas', function (Blueprint $table) {
            $table->foreignId('category_id')
                ->nullable()
                ->after('default_base')
                ->constrained('categories')
                ->nullOnDelete();
        });

        // Backfill: le pizze esistenti devono restare visibili sul tablet, che
        // filtra per chip categoria. Le si assegna alla categoria pizzeria "Pizze"
        // (creata se assente).
        $pizze = Category::firstOrCreate(
            ['name' => 'Pizze', 'department' => 'pizzeria'],
            ['sort_order' => 5, 'is_active' => true]
        );

        Pizza::whereNull('category_id')->update(['category_id' => $pizze->id]);
    }

    public function down(): void
    {
        Schema::table('pizzas', function (Blueprint $table) {
            $table->dropForeign(['category_id']);
            $table->dropColumn('category_id');
        });
    }
};
