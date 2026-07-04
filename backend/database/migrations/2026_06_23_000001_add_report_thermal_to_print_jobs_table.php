<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 'report_thermal' = stampa report cassa (non legata a un ordine).
        DB::statement("ALTER TABLE print_jobs MODIFY COLUMN print_type ENUM('cassiere','cucina','pizzeria','pre_conto','bar','scontrino_parziale','report_thermal') NOT NULL");

        // I report non hanno ordine/invio associato: rendiamo nullable le FK
        // (i vincoli restano e ammettono NULL).
        DB::statement("ALTER TABLE print_jobs MODIFY order_id BIGINT UNSIGNED NULL");
        DB::statement("ALTER TABLE print_jobs MODIFY order_send_id BIGINT UNSIGNED NULL");

        // Parametri del report da stampare (type, date, range) — il payload ESC/POS
        // viene generato in coda a partire da questi metadati.
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('pdf_backup_path');
        });
    }

    public function down(): void
    {
        Schema::table('print_jobs', function (Blueprint $table) {
            $table->dropColumn('meta');
        });

        // Ripulisce eventuali job report prima di restringere l'enum / i NOT NULL.
        DB::statement("DELETE FROM print_jobs WHERE print_type = 'report_thermal' OR order_id IS NULL OR order_send_id IS NULL");

        DB::statement("ALTER TABLE print_jobs MODIFY order_id BIGINT UNSIGNED NOT NULL");
        DB::statement("ALTER TABLE print_jobs MODIFY order_send_id BIGINT UNSIGNED NOT NULL");
        DB::statement("ALTER TABLE print_jobs MODIFY COLUMN print_type ENUM('cassiere','cucina','pizzeria','pre_conto','bar','scontrino_parziale') NOT NULL");
    }
};
