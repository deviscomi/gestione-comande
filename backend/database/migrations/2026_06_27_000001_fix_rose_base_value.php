<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('pizzas')
            ->where('default_base', 'Rosè')
            ->update(['default_base' => "Rose'"]);

        DB::table('order_item_mods')
            ->where('mod_type', 'pizza_base')
            ->where('mod_value', 'Rosè')
            ->update(['mod_value' => "Rose'"]);
    }

    public function down(): void
    {
        DB::table('pizzas')
            ->where('default_base', "Rose'")
            ->update(['default_base' => 'Rosè']);

        DB::table('order_item_mods')
            ->where('mod_type', 'pizza_base')
            ->where('mod_value', "Rose'")
            ->update(['mod_value' => 'Rosè']);
    }
};
