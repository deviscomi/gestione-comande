<?php

namespace Database\Factories;

use App\Models\Table;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'table_id'      => Table::factory(),
            'user_id'       => User::factory(),
            'covers'        => 2,
            'coperto_price' => 1.50,
            'order_number'  => $this->faker->unique()->numberBetween(1, 1000000),
            'status'        => 'open',
            'total'         => 0,
            'opened_at'     => now(),
            'first_sent_at' => null,
            'closed_at'     => null,
        ];
    }

    public function closed(): static
    {
        return $this->state([
            'status'    => 'closed',
            'closed_at' => now(),
        ]);
    }
}
