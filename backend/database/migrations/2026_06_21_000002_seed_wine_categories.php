<?php

use App\Models\Category;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        if (Category::where('department', 'carta_vini')->exists()) {
            return;
        }

        $defaults = [
            ['name' => 'Rosso',  'department' => 'carta_vini', 'sort_order' => 1],
            ['name' => 'Rosato', 'department' => 'carta_vini', 'sort_order' => 2],
            ['name' => 'Bianco', 'department' => 'carta_vini', 'sort_order' => 3],
        ];

        foreach ($defaults as $cat) {
            Category::create(array_merge($cat, ['is_active' => true]));
        }
    }

    public function down(): void
    {
        Category::where('department', 'carta_vini')
            ->whereIn('name', ['Rosso', 'Rosato', 'Bianco'])
            ->whereDoesntHave('wines')
            ->delete();
    }
};
