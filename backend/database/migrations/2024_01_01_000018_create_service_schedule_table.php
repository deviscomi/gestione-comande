<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_schedule', function (Blueprint $table) {
            $table->id();
            $table->enum('department', ['cucina', 'pizzeria']);
            $table->unsignedTinyInteger('day_of_week'); // 0=Lun, 6=Dom
            $table->boolean('is_active')->default(true);
            $table->unique(['department', 'day_of_week']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_schedule');
    }
};
