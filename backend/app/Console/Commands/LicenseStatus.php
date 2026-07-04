<?php

namespace App\Console\Commands;

use App\Models\Module;
use App\Services\LicenseService;
use Illuminate\Console\Command;

class LicenseStatus extends Command
{
    protected $signature   = 'license:status';
    protected $description = 'Mostra lo stato della licenza e dei moduli attivi';

    public function handle(LicenseService $license): int
    {
        $lic = $license->getLicense();

        $this->line('');
        $this->info('=== LICENZA ===');
        $this->line("  Intestatario : {$lic->licensee_name}");
        $this->line("  Tier         : {$lic->tier}");
        $this->line('  Scadenza     : ' . ($lic->expires_at?->format('d/m/Y') ?? 'Nessuna scadenza'));
        if ($lic->isExpired()) {
            $this->error('  *** LICENZA SCADUTA ***');
        }

        $this->line('');
        $this->info('=== MODULI ===');

        $modules = Module::orderBy('sort_order')->get();
        $rows = $modules->map(fn ($m) => [
            $m->slug,
            $m->name,
            $m->is_active ? '<fg=green>ATTIVO</>' : '<fg=red>DISATTIVO</>',
        ])->toArray();

        $this->table(['Slug', 'Nome', 'Stato'], $rows);

        return self::SUCCESS;
    }
}
