<?php

namespace App\Console\Commands;

use App\Models\Module;
use App\Services\LicenseService;
use Illuminate\Console\Command;

class LicenseActivate extends Command
{
    protected $signature   = 'license:activate {slug : Slug del modulo da attivare}';
    protected $description = 'Attiva un modulo della licenza';

    public function handle(LicenseService $license): int
    {
        $slug = $this->argument('slug');

        if ($slug === 'core') {
            $this->warn('Il modulo "core" è sempre attivo e non può essere modificato.');
            return self::FAILURE;
        }

        $module = Module::where('slug', $slug)->first();

        if (! $module) {
            $this->error("Modulo \"{$slug}\" non trovato.");
            return self::FAILURE;
        }

        if ($module->is_active) {
            $this->info("Il modulo \"{$slug}\" è già attivo.");
            return self::SUCCESS;
        }

        $module->update(['is_active' => true]);
        $license->flushCache();

        $this->info("Modulo \"{$slug}\" ({$module->name}) attivato.");
        return self::SUCCESS;
    }
}
