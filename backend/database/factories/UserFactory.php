<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'          => $this->faker->firstName(),
            'surname'       => $this->faker->lastName(),
            'username'      => $this->faker->unique()->userName(),
            'password_hash' => Hash::make('password'),
            'role'          => 'waiter',
            'pin'           => '1234',
            'status'        => 'active',
        ];
    }

    public function admin(): static
    {
        return $this->state(['role' => 'admin']);
    }
}
