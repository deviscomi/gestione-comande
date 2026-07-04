<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderSend;
use Illuminate\Database\Eloquent\Factories\Factory;

class PrintJobFactory extends Factory
{
    public function definition(): array
    {
        return [
            'order_id'         => Order::factory(),
            'order_send_id'    => OrderSend::factory(),
            'printer_id'       => null,
            'print_type'       => 'cassiere',
            'status'           => 'pending',
            'attempts'         => 0,
            'is_reprint'       => false,
            'pdf_backup_path'  => null,
        ];
    }
}
