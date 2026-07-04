<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderSend;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderItemPriceUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->admin()->create());
    }

    private function makeOrder(): Order
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        return Order::factory()->for($table)->create([
            'status'        => 'open',
            'covers'        => 0,
            'coperto_price' => 0,
        ]);
    }

    public function test_final_unit_price_is_stored_as_base_minus_variants(): void
    {
        $order = $this->makeOrder();
        $send  = OrderSend::factory()->for($order)->create();

        $item = OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'item_type'     => 'dish',
            'quantity'      => 1,
            'unit_price'    => 8,
            'total_price'   => 9.50,
            'status'        => 'pending',
        ]);
        $item->modifications()->create([
            'mod_type'     => 'extra',
            'mod_value'    => 'Doppia mozzarella',
            'price_change' => 1.50,
        ]);

        // Il cameriere imposta il prezzo finale (varianti incluse) a 10,00
        $this->patchJson("/api/v1/orders/{$order->id}/items/{$item->id}", [
            'final_unit_price' => 10.00,
        ])->assertOk();

        $item->refresh();
        $order->refresh();

        // base = 10,00 - 1,50 = 8,50 ; total = (8,50 + 1,50) * 1 = 10,00
        $this->assertEquals(8.50, (float) $item->unit_price);
        $this->assertEquals(10.00, (float) $item->total_price);
        $this->assertEquals(10.00, (float) $order->total);
    }

    public function test_final_unit_price_scales_line_total_by_quantity(): void
    {
        $order = $this->makeOrder();
        $send  = OrderSend::factory()->for($order)->create();

        $item = OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'item_type'     => 'dish',
            'quantity'      => 2,
            'unit_price'    => 8,
            'total_price'   => 19.00,
            'status'        => 'pending',
        ]);
        $item->modifications()->create([
            'mod_type'     => 'extra',
            'mod_value'    => 'Doppia mozzarella',
            'price_change' => 1.50,
        ]);

        $this->patchJson("/api/v1/orders/{$order->id}/items/{$item->id}", [
            'final_unit_price' => 10.00,
        ])->assertOk();

        $item->refresh();

        $this->assertEquals(8.50, (float) $item->unit_price);
        $this->assertEquals(20.00, (float) $item->total_price); // 10,00 * 2
    }

    public function test_final_unit_price_without_variants_equals_base(): void
    {
        $order = $this->makeOrder();
        $send  = OrderSend::factory()->for($order)->create();

        $item = OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'item_type'     => 'dish',
            'quantity'      => 1,
            'unit_price'    => 10,
            'total_price'   => 10,
            'status'        => 'pending',
        ]);

        $this->patchJson("/api/v1/orders/{$order->id}/items/{$item->id}", [
            'final_unit_price' => 12.00,
        ])->assertOk();

        $item->refresh();

        $this->assertEquals(12.00, (float) $item->unit_price);
        $this->assertEquals(12.00, (float) $item->total_price);
    }
}
