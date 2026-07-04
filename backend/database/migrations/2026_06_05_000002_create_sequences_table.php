<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sequences', function (Blueprint $table) {
            $table->string('name', 50)->primary();
            $table->unsignedBigInteger('value')->default(0);
        });

        // Inizializza la sequenza al MAX attuale degli ordini esistenti.
        // Su database vuoto partirà da 0 (il prossimo ordine riceverà #1).
        $maxOrderNumber = DB::table('orders')->max('order_number') ?? 0;

        DB::table('sequences')->insert([
            'name'  => 'order_number',
            'value' => $maxOrderNumber,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('sequences');
    }
};
