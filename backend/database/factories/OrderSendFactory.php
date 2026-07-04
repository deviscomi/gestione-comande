<?php

namespace Database\Factories;

use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrderSendFactory extends Factory
{
    public function definition(): array
    {
        return [
            'order_id'    => Order::factory(),
            'send_number' => 1,
            'sent_at'     => now(),
        ];
    }
}
