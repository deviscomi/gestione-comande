<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('coperto_price', 8, 2)
                  ->default(0.00)
                  ->after('covers')
                  ->comment('Prezzo coperto per persona (snapshot al momento della creazione)');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('coperto_price');
        });
    }
};
