<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE printers MODIFY department ENUM('cassiere', 'cucina', 'pizzeria', 'bar') NOT NULL");
        DB::statement("ALTER TABLE service_schedule MODIFY department ENUM('cucina', 'pizzeria', 'bar') NOT NULL");
        DB::statement("ALTER TABLE kds_statuses MODIFY department ENUM('cucina', 'pizzeria', 'bar') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE printers MODIFY department ENUM('cassiere', 'cucina', 'pizzeria') NOT NULL");
        DB::statement("ALTER TABLE service_schedule MODIFY department ENUM('cucina', 'pizzeria') NOT NULL");
        DB::statement("ALTER TABLE kds_statuses MODIFY department ENUM('cucina', 'pizzeria') NOT NULL");
    }
};
