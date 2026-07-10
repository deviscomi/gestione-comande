<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Dish;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderSend;
use App\Models\Pizza;
use App\Models\PrintJob;
use App\Services\EscPosRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EscPosRendererPizzeriaTest extends TestCase
{
    use RefreshDatabase;

    private function makeCategory(string $department): Category
    {
        return Category::create([
            'name'       => ucfirst($department),
            'department' => $department,
            'sort_order' => 0,
            'is_active'  => true,
        ]);
    }

    private function addPizza(Order $order, OrderSend $send, int $uscita): void
    {
        $pizza = Pizza::create([
            'category_id' => $this->makeCategory('pizzeria')->id,
            'name'        => 'Margherita',
            'base_price'  => 6,
            'is_active'   => true,
            'default_base' => 'R',
        ]);

        OrderItem::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'item_type'     => 'pizza',
            'pizza_id'      => $pizza->id,
            'quantity'      => 1,
            'unit_price'    => 6,
            'total_price'   => 6,
            'status'        => 'sent',
            'uscita'        => $uscita,
            'sort_order'    => 0,
        ]);
    }

    private function addDish(Order $order, OrderSend $send, int $uscita, string $department, string $name): void
    {
        $dish = Dish::create([
            'category_id' => $this->makeCategory($department)->id,
            'name'        => $name,
            'price'       => 8,
            'is_active'   => true,
        ]);

        OrderItem::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'item_type'     => 'dish',
            'dish_id'       => $dish->id,
            'quantity'      => 1,
            'unit_price'    => 8,
            'total_price'   => 8,
            'status'        => 'sent',
            'uscita'        => $uscita,
            'sort_order'    => 0,
        ]);
    }

    public function test_pizzeria_ticket_beverage_does_not_trigger_con_cucina(): void
    {
        $order = Order::factory()->create(['covers' => 4]);
        $send  = OrderSend::factory()->for($order)->create(['send_number' => 1]);

        // Uscita 1: pizza + bevanda (dish reparto bar) -> deve risultare SOLO PIZZA
        $this->addPizza($order, $send, 1);
        $this->addDish($order, $send, 1, 'bevande', 'Coca Cola');

        // Uscita 2: solo costata di maiale (dish cucina, nessuna pizza) -> non appare sulla pizzeria
        $this->addDish($order, $send, 2, 'cucina', 'Costata di maiale');

        // Uscita 3: pizza + piatto di cucina reale -> deve risultare CON CUCINA
        $this->addPizza($order, $send, 3);
        $this->addDish($order, $send, 3, 'cucina', 'Grigliata');

        $job = PrintJob::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'print_type'    => 'pizzeria',
        ]);

        $out = EscPosRenderer::render($job->load('order', 'orderSend'));

        // Uscita 1: la bevanda non conta come cucina
        $this->assertStringContainsString('USCITA 1  SOLO PIZZA', $out);
        $this->assertStringNotContainsString('USCITA 1  [CON CUCINA]', $out);

        // Uscita 2: nessuna pizza -> non stampata sulla pizzeria
        $this->assertStringNotContainsString('USCITA 2', $out);

        // Uscita 3: piatto di cucina reale + pizza -> CON CUCINA
        $this->assertStringContainsString('USCITA 3  [CON CUCINA]', $out);
    }
}
