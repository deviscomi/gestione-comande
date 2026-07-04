<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('print_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_send_id')->constrained()->cascadeOnDelete();
            $table->foreignId('printer_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('print_type', ['cassiere', 'cucina', 'pizzeria']);
            $table->enum('status', ['pending', 'printing', 'done', 'failed'])->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->string('pdf_backup_path', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('printed_at')->nullable();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_jobs');
    }
};
