<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingredient_categories', function (Blueprint $table) {
            $table->enum('department', ['cucina', 'bar', 'pizzeria', 'vini'])->default('cucina')->after('name');
        });

        Schema::table('ingredients', function (Blueprint $table) {
            $table->enum('department', ['cucina', 'bar', 'pizzeria', 'vini'])->default('cucina')->after('name');
        });

        Schema::table('dish_variant_groups', function (Blueprint $table) {
            $table->enum('department', ['cucina', 'bar', 'pizzeria', 'vini'])->default('cucina')->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('ingredient_categories', function (Blueprint $table) {
            $table->dropColumn('department');
        });

        Schema::table('ingredients', function (Blueprint $table) {
            $table->dropColumn('department');
        });

        Schema::table('dish_variant_groups', function (Blueprint $table) {
            $table->dropColumn('department');
        });
    }
};
