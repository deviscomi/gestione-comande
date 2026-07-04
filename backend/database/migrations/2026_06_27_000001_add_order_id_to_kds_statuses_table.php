<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kds_statuses', function (Blueprint $table) {
            $table->foreignId('order_id')->nullable()->after('id')->constrained('orders')->cascadeOnDelete();
        });

        DB::statement('UPDATE kds_statuses ks JOIN order_sends os ON os.id = ks.order_send_id SET ks.order_id = os.order_id');

        // Più invii della stessa uscita/reparto collassano sulla chiave (order_id, uscita,
        // department): tiene la riga più recente prima di poter creare la nuova unique.
        DB::statement('
            DELETE k1 FROM kds_statuses k1
            JOIN kds_statuses k2
                ON k1.order_id = k2.order_id
               AND k1.uscita = k2.uscita
               AND k1.department = k2.department
               AND k1.id < k2.id
        ');

        Schema::table('kds_statuses', function (Blueprint $table) {
            $table->dropForeign(['order_send_id']);
            $table->dropUnique(['order_send_id', 'uscita', 'department']);
        });

        Schema::table('kds_statuses', function (Blueprint $table) {
            $table->unsignedBigInteger('order_send_id')->nullable()->change();
            $table->unique(['order_id', 'uscita', 'department']);
            $table->foreign('order_send_id')->references('id')->on('order_sends')->cascadeOnDelete();
        });

        DB::statement("ALTER TABLE kds_statuses MODIFY department ENUM('cucina','pizzeria','bar') NOT NULL");
    }

    public function down(): void
    {
        Schema::table('kds_statuses', function (Blueprint $table) {
            $table->dropForeign(['order_send_id']);
            $table->dropUnique(['order_id', 'uscita', 'department']);
            $table->dropConstrainedForeignId('order_id');
        });

        Schema::table('kds_statuses', function (Blueprint $table) {
            $table->unsignedBigInteger('order_send_id')->nullable(false)->change();
            $table->unique(['order_send_id', 'uscita', 'department']);
            $table->foreign('order_send_id')->references('id')->on('order_sends')->cascadeOnDelete();
        });

        DB::statement("ALTER TABLE kds_statuses MODIFY department ENUM('cucina','pizzeria') NOT NULL");
    }
};
