<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_devices', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('driver', 30); // epson_fp|custom|rch_webservice|generic_http|generic_bridge
            $table->string('connection_type', 30); // lan_tcp|http_webservice|local_bridge
            $table->string('ip_address')->nullable();
            $table->unsignedInteger('port')->nullable();
            $table->string('base_url')->nullable();
            $table->text('auth_token')->nullable();
            $table->string('fiscal_serial_number', 50)->nullable();
            $table->string('vat_number', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_devices');
    }
};
