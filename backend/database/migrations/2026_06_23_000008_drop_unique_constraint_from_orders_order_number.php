<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // order_number riparte da #0001 ad ogni chiusura giornaliera (vedi
        // DailyClosureController::store()), quindi si ripete tra giorni diversi:
        // un vincolo unique globale è incompatibile con questo comportamento.
        // L'unicità nello stesso giorno è già garantita dall'incremento atomico
        // su sequences con lockForUpdate.
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['order_number']);
            $table->index('order_number');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['order_number']);
            $table->unique('order_number');
        });
    }
};
