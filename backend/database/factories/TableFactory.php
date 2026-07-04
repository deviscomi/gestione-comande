<?php

namespace Database\Factories;

use App\Models\Zone;
use Illuminate\Database\Eloquent\Factories\Factory;

class TableFactory extends Factory
{
    public function definition(): array
    {
        return [
            'zone_id' => Zone::factory(),
            'number'  => $this->faker->unique()->numberBetween(1, 9000),
            'suffix'  => null,
            'status'  => 'libero',
        ];
    }
}
