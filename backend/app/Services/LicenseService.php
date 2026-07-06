<?php

namespace App\Services;

use App\Models\License;
use App\Models\Module;
use Illuminate\Support\Facades\Cache;

class LicenseService
{
    /** Tier commerciali ammessi. kds è l'unico modulo discriminante. */
    public const TIERS = ['base', 'pro'];

    /**
     * Riconcilia lo stato dei moduli in base al tier della licenza.
     *
     * kds è l'UNICO discriminante fra i piani: pro ⇒ kds attivo, base ⇒ kds
     * spento. Gli altri moduli non vengono toccati (restano come configurati
     * dall'operatore). Invalida la cache dei moduli.
     */
    public function applyTier(string $tier): void
    {
        Module::where('slug', 'kds')->update(['is_active' => $tier === 'pro']);

        $this->flushCache();
    }

    public function isActive(string $slug): bool
    {
        if ($slug === 'core') {
            return true;
        }

        return Cache::remember("module.{$slug}", 60, function () use ($slug) {
            return Module::where('slug', $slug)->value('is_active') ?? false;
        });
    }

    public function requireModule(string $slug): void
    {
        if (! $this->isActive($slug)) {
            abort(response()->json([
                'message'    => 'Funzionalità non disponibile in questa licenza',
                'error_code' => 'module_disabled',
                'module'     => $slug,
            ], 403));
        }
    }

    public function activeModules(): array
    {
        return Cache::remember('modules.active_list', 60, function () {
            return Module::orderBy('sort_order')
                ->get()
                ->map(fn ($m) => [
                    'slug'      => $m->slug,
                    'name'      => $m->name,
                    'description' => $m->description,
                    'is_active' => $m->is_active,
                ])
                ->toArray();
        });
    }

    public function getLicense(): License
    {
        return License::current();
    }

    public function flushCache(): void
    {
        Cache::forget('modules.active_list');

        $slugs = Module::pluck('slug');
        foreach ($slugs as $slug) {
            Cache::forget("module.{$slug}");
        }
    }
}
