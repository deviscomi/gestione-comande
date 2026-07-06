<?php

namespace App\Console\Commands;

use App\Models\License;
use App\Services\LicenseService;
use Illuminate\Console\Command;

class LicenseSetTier extends Command
{
    protected $signature   = 'license:set-tier {tier : Fascia commerciale (base|pro)}';
    protected $description = 'Assegna il tier alla licenza e riconcilia i moduli (kds on/off)';

    public function handle(LicenseService $license): int
    {
        $tier = strtolower(trim($this->argument('tier')));

        if (! in_array($tier, LicenseService::TIERS, true)) {
            $this->error('Tier non valido: usare uno tra ' . implode(', ', LicenseService::TIERS) . '.');
            return self::FAILURE;
        }

        $lic = License::current();
        $lic->update(['tier' => $tier]);

        // Riconcilia i moduli in base al tier (pro ⇒ kds on, base ⇒ kds off)
        // e invalida la cache dei moduli.
        $license->applyTier($tier);

        $this->info("Tier impostato a \"{$tier}\". KDS " . ($tier === 'pro' ? 'ATTIVO' : 'spento') . '.');
        return self::SUCCESS;
    }
}
