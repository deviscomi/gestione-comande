<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            // Lease per la modalità di stampa 'agent': quando il Raspberry
            // preleva un job lo marca 'printing' + claimed_at=now. Se non
            // arriva l'ACK entro printing.agent_lease_seconds, il job torna
            // prelevabile. Inutilizzato in modalità 'socket'.
            $table->timestamp('claimed_at')->nullable()->after('printed_at');
        });
    }

    public function down(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->dropColumn('claimed_at');
        });
    }
};
