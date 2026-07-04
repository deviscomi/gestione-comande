<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_id')->constrained('tables')->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('covers')->default(0);
            $table->unsignedInteger('order_number')->unique();
            $table->enum('status', ['open', 'closed', 'locked'])->default('open');
            $table->decimal('total', 10, 2)->default(0.00);
            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('first_sent_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->index(['table_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
