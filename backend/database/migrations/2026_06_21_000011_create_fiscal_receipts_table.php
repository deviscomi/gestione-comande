<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_payment_id')->unique()->constrained('order_payments')->cascadeOnDelete();
            $table->foreignId('fiscal_device_id')->nullable()->constrained('fiscal_devices')->nullOnDelete();
            $table->string('fiscal_status', 20)->default('pending'); // pending|issued|failed|voided
            $table->string('fiscal_receipt_number')->nullable();
            $table->string('lottery_code')->nullable();
            $table->timestamp('fiscal_emitted_at')->nullable();
            $table->text('fiscal_error_message')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->json('raw_response')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_receipts');
    }
};
