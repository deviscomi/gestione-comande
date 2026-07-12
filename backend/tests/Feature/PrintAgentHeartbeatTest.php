<?php

namespace Tests\Feature;

use App\Models\Printer;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Heartbeat dell'agente di stampa (Raspberry Pi) e stato per il backoffice.
 * Vedi PrintAgentController::heartbeat() / ::status() e docs/REMOTE_PRINTING.md.
 */
class PrintAgentHeartbeatTest extends TestCase
{
    use RefreshDatabase;

    private function enablePrintingModule(): void
    {
        // Il modulo 'printing' è gated da LicenseService::isActive: nei test lo
        // forziamo attivo per non dipendere da una licenza reale.
        $this->mock(LicenseService::class, function ($m) {
            $m->shouldReceive('isActive')->andReturn(true);
        });
    }

    private function agentMode(string $token = 'secret-agent-token'): void
    {
        config(['printing.driver' => 'agent', 'printing.agent_token' => $token]);
    }

    public function test_heartbeat_richiede_il_token_agente(): void
    {
        $this->enablePrintingModule();
        $this->agentMode();

        $this->postJson('/api/v1/agent/heartbeat', [], ['X-Agent-Token' => 'sbagliato'])
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'agent_unauthorized');
    }

    public function test_heartbeat_salva_lo_stato_e_restituisce_inventario_stampanti(): void
    {
        $this->enablePrintingModule();
        $this->agentMode('secret-agent-token');

        $printer = Printer::create([
            'name' => 'Cucina', 'department' => 'cucina',
            'ip_address' => '192.168.1.50', 'port' => 9100, 'is_active' => true,
        ]);
        // Stampante disattivata: non deve comparire nell'inventario.
        Printer::create([
            'name' => 'Bar off', 'department' => 'bar',
            'ip_address' => '192.168.1.52', 'port' => 9100, 'is_active' => false,
        ]);

        $this->postJson('/api/v1/agent/heartbeat', [
            'uptime_seconds' => 123,
            'agent_version'  => '1.1.0',
            'printers'       => [['id' => $printer->id, 'reachable' => true, 'latency_ms' => 8]],
        ], ['X-Agent-Token' => 'secret-agent-token'])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('printers.0.id', $printer->id)
            ->assertJsonCount(1, 'printers'); // solo la stampante attiva
    }

    public function test_status_riflette_online_dopo_heartbeat(): void
    {
        $this->enablePrintingModule();
        $this->agentMode('secret-agent-token');

        $printer = Printer::create([
            'name' => 'Cucina', 'department' => 'cucina',
            'ip_address' => '192.168.1.50', 'port' => 9100, 'is_active' => true,
        ]);

        // L'agente invia un heartbeat...
        $this->postJson('/api/v1/agent/heartbeat', [
            'uptime_seconds' => 60, 'agent_version' => '1.1.0',
            'printers' => [['id' => $printer->id, 'reachable' => false, 'latency_ms' => null]],
        ], ['X-Agent-Token' => 'secret-agent-token'])->assertOk();

        // ...e il backoffice (admin) lo vede online.
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/v1/agent-status')
            ->assertOk()
            ->assertJsonPath('applicable', true)
            ->assertJsonPath('online', true)
            ->assertJsonPath('agent_version', '1.1.0')
            ->assertJsonPath('printers.0.reachable', false);
    }

    public function test_status_non_applicabile_in_modalita_socket(): void
    {
        $this->enablePrintingModule();
        config(['printing.driver' => 'socket']);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->getJson('/api/v1/agent-status')
            ->assertOk()
            ->assertJsonPath('applicable', false);
    }
}
