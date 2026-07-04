<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->unsignedInteger('number');
            $table->enum('suffix', ['bis', 'tris'])->nullable();
            $table->enum('status', ['libero', 'occupato', 'in_corso'])->default('libero');
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['zone_id', 'number', 'suffix']);
            $table->index(['zone_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tables');
    }
};
