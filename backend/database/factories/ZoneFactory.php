<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ZoneFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'        => $this->faker->unique()->word(),
            'is_outdoor'  => false,
            'is_enabled'  => true,
            'sort_order'  => 0,
        ];
    }
}
