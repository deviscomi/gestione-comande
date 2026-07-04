<?php

namespace Tests\Feature;

use App\Models\DailyClosure;
use App\Models\KdsStatus;
use App\Models\Module;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderSend;
use App\Models\PrintJob;
use App\Models\Table;
use App\Models\User;
use App\Services\ReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DailyClosureControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
        Sanctum::actingAs($this->admin);
        Storage::fake('local');
        Module::create(['slug' => 'daily_closure', 'name' => 'Chiusura giornaliera', 'is_active' => true]);
    }

    public function test_store_without_force_fails_when_tables_are_open(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        Order::factory()->for($table)->create(['status' => 'open']);

        $response = $this->postJson('/api/v1/daily-closures', ['force' => false]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('daily_closures', 0);
        $table->refresh();
        $this->assertSame('occupato', $table->status);
    }

    public function test_store_with_force_closes_open_tables_and_their_orders(): void
    {
        $table = Table::factory()->create(['status' => 'in_corso']);
        $order = Order::factory()->for($table)->create(['status' => 'open', 'covers' => 3, 'coperto_price' => 1]);
        $send  = OrderSend::factory()->for($order)->create();

        $pendingItem = OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'status'        => 'pending',
            'total_price'   => 10,
        ]);
        $sentItem = OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'status'        => 'sent',
            'total_price'   => 25,
        ]);

        Storage::put('print_backups/order.pdf', 'pdf-content');
        $printJob = PrintJob::factory()->for($order)->create([
            'order_send_id'   => $send->id,
            'pdf_backup_path' => 'print_backups/order.pdf',
        ]);

        $response = $this->postJson('/api/v1/daily-closures', ['force' => true]);

        $response->assertStatus(201);

        $table->refresh();
        $order->refresh();
        $pendingItem->refresh();
        $sentItem->refresh();

        $this->assertSame('libero', $table->status);
        $this->assertSame('locked', $order->status);
        $this->assertNotNull($order->closed_at);
        $this->assertTrue($order->closed_at->isToday());
        $this->assertSame('cancelled', $pendingItem->status);
        $this->assertSame('sent', $sentItem->status);
        // Totale ricalcolato: solo l'item non annullato + coperto (3 * 1)
        $this->assertEquals(28.00, (float) $order->total);

        // Il PDF di backup viene eliminato durante il forceClose, prima ancora
        // che la riga print_jobs venga rimossa dallo svuotamento di fine chiusura
        Storage::assertMissing('print_backups/order.pdf');
        $this->assertModelMissing($printJob);
    }

    public function test_store_with_force_resets_order_number_sequence(): void
    {
        DB::table('sequences')->where('name', 'order_number')->update(['value' => 42]);

        $table = Table::factory()->create(['status' => 'occupato']);
        Order::factory()->for($table)->create(['status' => 'open']);

        $this->postJson('/api/v1/daily-closures', ['force' => true])->assertStatus(201);

        $this->assertSame(0, (int) DB::table('sequences')->where('name', 'order_number')->value('value'));

        // Il prossimo ordine creato riparte da #0001
        $newTable = Table::factory()->create(['status' => 'libero']);
        $createResponse = $this->postJson('/api/v1/orders', ['table_id' => $newTable->id]);
        $createResponse->assertStatus(201);
        $this->assertSame(1, $createResponse->json('order_number'));
    }

    public function test_store_with_force_truncates_print_jobs_and_resets_autoincrement(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        $order = Order::factory()->for($table)->create(['status' => 'open']);
        $send  = OrderSend::factory()->for($order)->create();

        PrintJob::factory()->count(3)->for($order)->create(['order_send_id' => $send->id]);
        PrintJob::factory()->create([
            'order_id'      => null,
            'order_send_id' => null,
            'print_type'    => 'report_thermal',
            'status'        => 'failed',
        ]);

        $this->assertDatabaseCount('print_jobs', 4);

        $this->postJson('/api/v1/daily-closures', ['force' => true])->assertStatus(201);

        $this->assertDatabaseCount('print_jobs', 0);

        $freshOrder = Order::factory()->create();
        $freshSend  = OrderSend::factory()->for($freshOrder)->create();
        $newJob = PrintJob::factory()->for($freshOrder)->create(['order_send_id' => $freshSend->id]);

        $this->assertSame(1, $newJob->id);
    }

    public function test_report_daily_counts_force_closed_orders(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        $order = Order::factory()->for($table)->create(['status' => 'open', 'covers' => 2, 'coperto_price' => 0]);
        $send  = OrderSend::factory()->for($order)->create();
        OrderItem::factory()->for($order)->create([
            'order_send_id' => $send->id,
            'status'        => 'sent',
            'total_price'   => 50,
        ]);

        $this->postJson('/api/v1/daily-closures', ['force' => true])->assertStatus(201);

        $report = app(ReportService::class)->daily(today()->toDateString());

        $this->assertSame(1, $report['orders_count']);
        $this->assertEquals(50.0, $report['total']);
        $this->assertSame(2, $report['covers']);
    }

    public function test_store_with_force_logs_activity_summary(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        Order::factory()->for($table)->create(['status' => 'open']);
        PrintJob::factory()->create(['order_id' => null, 'order_send_id' => null, 'print_type' => 'report_thermal']);

        $this->postJson('/api/v1/daily-closures', ['force' => true])->assertStatus(201);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'DAILY_CLOSURE',
        ]);

        $log = DB::table('activity_logs')->where('action', 'DAILY_CLOSURE')->first();
        $this->assertStringContainsString('Tavoli chiusi forzatamente: 1', $log->description);
        $this->assertStringContainsString('Numero comanda azzerato', $log->description);
        $this->assertStringContainsString('Print job eliminati', $log->description);
    }

    public function test_check_reports_kds_comande_in_preparazione(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        $order = Order::factory()->for($table)->create(['status' => 'open']);
        $send  = OrderSend::factory()->for($order)->create();

        KdsStatus::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'uscita'        => 1,
            'department'    => 'cucina',
            'status'        => 'in_corso',
        ]);
        KdsStatus::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'uscita'        => 2,
            'department'    => 'pizzeria',
            'status'        => 'pending',
        ]);
        // Una riga già pronta non deve essere conteggiata
        KdsStatus::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'uscita'        => 3,
            'department'    => 'bar',
            'status'        => 'pronto',
        ]);

        $response = $this->getJson('/api/v1/daily-closures/check');

        $response->assertStatus(200);
        $response->assertJsonPath('kds_in_preparazione_count', 1);
        $response->assertJsonPath('kds_in_preparazione.0.order_id', $order->id);
        $response->assertJsonPath('kds_in_preparazione.0.table_number', $table->number);
        $response->assertJsonPath('kds_in_preparazione.0.count', 2);
    }

    public function test_store_clears_kds_statuses_and_resets_autoincrement(): void
    {
        $table = Table::factory()->create(['status' => 'occupato']);
        $order = Order::factory()->for($table)->create(['status' => 'open']);
        $send  = OrderSend::factory()->for($order)->create();

        KdsStatus::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'uscita'        => 1,
            'department'    => 'cucina',
            'status'        => 'in_corso',
        ]);
        KdsStatus::create([
            'order_id'      => $order->id,
            'order_send_id' => $send->id,
            'uscita'        => 2,
            'department'    => 'pizzeria',
            'status'        => 'pending',
        ]);

        $this->assertDatabaseCount('kds_statuses', 2);

        $this->postJson('/api/v1/daily-closures', ['force' => true])->assertStatus(201);

        $this->assertDatabaseCount('kds_statuses', 0);

        // L'auto-increment è ripartito da 1
        $freshOrder = Order::factory()->create(['status' => 'open']);
        $freshSend  = OrderSend::factory()->for($freshOrder)->create();
        $newKds = KdsStatus::create([
            'order_id'      => $freshOrder->id,
            'order_send_id' => $freshSend->id,
            'uscita'        => 1,
            'department'    => 'cucina',
            'status'        => 'pending',
        ]);

        $this->assertSame(1, $newKds->id);
    }

    public function test_store_without_open_tables_does_not_touch_other_tables(): void
    {
        $freeTable = Table::factory()->create(['status' => 'libero']);

        $this->postJson('/api/v1/daily-closures', ['force' => false])->assertStatus(201);

        $freeTable->refresh();
        $this->assertSame('libero', $freeTable->status);
        $this->assertDatabaseCount('daily_closures', 1);
    }
}
