<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderSend;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrderItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'order_id'      => Order::factory(),
            'order_send_id' => OrderSend::factory(),
            'item_type'     => 'dish',
            'quantity'      => 1,
            'unit_price'    => 10,
            'total_price'   => 10,
            'status'        => 'pending',
            'sort_order'    => 0,
        ];
    }
}
