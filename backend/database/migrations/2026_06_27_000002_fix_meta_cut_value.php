<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('order_item_mods')
            ->where('mod_type', 'pizza_cut')
            ->where('mod_value', 'metà')
            ->update(['mod_value' => "meta'"]);
    }

    public function down(): void
    {
        DB::table('order_item_mods')
            ->where('mod_type', 'pizza_cut')
            ->where('mod_value', "meta'")
            ->update(['mod_value' => 'metà']);
    }
};
