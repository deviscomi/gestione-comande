<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE order_items MODIFY item_type ENUM('dish', 'pizza', 'wine') NOT NULL");

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('wine_id')->nullable()->after('pizza_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('wine_id');
        });

        DB::statement("ALTER TABLE order_items MODIFY item_type ENUM('dish', 'pizza') NOT NULL");
    }
};
