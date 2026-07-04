<?php

namespace App\Console\Commands;

use App\Models\Module;
use App\Services\LicenseService;
use Illuminate\Console\Command;

class LicenseDeactivate extends Command
{
    protected $signature   = 'license:deactivate {slug : Slug del modulo da disattivare}';
    protected $description = 'Disattiva un modulo della licenza';

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

        if (! $module->is_active) {
            $this->info("Il modulo \"{$slug}\" è già disattivo.");
            return self::SUCCESS;
        }

        $module->update(['is_active' => false]);
        $license->flushCache();

        $this->info("Modulo \"{$slug}\" ({$module->name}) disattivato.");
        return self::SUCCESS;
    }
}
