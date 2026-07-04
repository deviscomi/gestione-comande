<?php

namespace Tests\Feature;

use App\Models\KdsStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderSend;
use App\Models\PrintJob;
use App\Models\Table;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderControllerCloseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Sanctum::actingAs(User::factory()->admin()->create());
        Storage::fake('local');
    }

    public function test_close_cancels_pending_items_recalculates_total_and_frees_table(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        $order = Order::factory()->for($table)->create(['status' => 'open', 'covers' => 1, 'coperto_price' => 2]);
        $send  = OrderSend::factory()->for($order)->create();

        $pendingItem = OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'status'        => 'pending',
            'total_price'   => 15,
        ]);
        $sentItem = OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'status'        => 'sent',
            'total_price'   => 20,
        ]);

        Storage::put('print_backups/order.pdf', 'pdf-content');
        $printJob = PrintJob::factory()->for($order)->create([
            'order_send_id'   => $send->id,
            'pdf_backup_path' => 'print_backups/order.pdf',
        ]);

        $response = $this->patchJson("/api/v1/orders/{$order->id}/close");

        $response->assertStatus(204);

        $order->refresh();
        $pendingItem->refresh();
        $sentItem->refresh();
        $printJob->refresh();
        $table->refresh();

        $this->assertSame('closed', $order->status);
        $this->assertNotNull($order->closed_at);
        $this->assertSame('cancelled', $pendingItem->status);
        $this->assertSame('sent', $sentItem->status);
        $this->assertEquals(22.00, (float) $order->total); // 20 + coperto (1 * 2)
        $this->assertNull($printJob->pdf_backup_path);
        Storage::assertMissing('print_backups/order.pdf');
        $this->assertSame('libero', $table->status);
    }

    public function test_close_deletes_kds_statuses_of_the_order(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        $order = Order::factory()->for($table)->create(['status' => 'open']);
        $send  = OrderSend::factory()->for($order)->create();

        $kds1 = KdsStatus::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'uscita'        => 1,
            'department'    => 'cucina',
            'status'        => 'in_corso',
        ]);
        $kds2 = KdsStatus::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'uscita'        => 1,
            'department'    => 'pizzeria',
            'status'        => 'pending',
        ]);

        $this->patchJson("/api/v1/orders/{$order->id}/close")->assertStatus(204);

        $this->assertModelMissing($kds1);
        $this->assertModelMissing($kds2);
        $this->assertDatabaseCount('kds_statuses', 0);
    }

    public function test_close_fails_when_order_is_already_locked(): void
    {
        $order = Order::factory()->create(['status' => 'locked']);

        $response = $this->patchJson("/api/v1/orders/{$order->id}/close");

        $response->assertStatus(422);
    }
}
