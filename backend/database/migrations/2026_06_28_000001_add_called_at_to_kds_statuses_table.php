<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kds_statuses', function (Blueprint $table) {
            // Timestamp di "chiamata" dal bar: NULL = uscita ancora IN ATTESA,
            // valorizzato = il bar ha chiamato il reparto (cucina/pizzeria può procedere).
            $table->timestamp('called_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('kds_statuses', function (Blueprint $table) {
            $table->dropColumn('called_at');
        });
    }
};
