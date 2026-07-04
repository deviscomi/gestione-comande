<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kds_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_send_id')->constrained('order_sends')->cascadeOnDelete();
            $table->unsignedTinyInteger('uscita');
            $table->enum('department', ['cucina', 'pizzeria']);
            $table->enum('status', ['pending', 'in_corso', 'pronto'])->default('pending');
            $table->timestamp('updated_at')->nullable();
            $table->unique(['order_send_id', 'uscita', 'department']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kds_statuses');
    }
};
