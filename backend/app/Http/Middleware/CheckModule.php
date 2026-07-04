<?php

namespace App\Http\Middleware;

use App\Services\LicenseService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckModule
{
    public function __construct(private LicenseService $license) {}

    public function handle(Request $request, Closure $next, string $slug): Response
    {
        if (! $this->license->isActive($slug)) {
            return response()->json([
                'message'    => 'Funzionalità non disponibile in questa licenza',
                'error_code' => 'module_disabled',
                'module'     => $slug,
            ], 403);
        }

        return $next($request);
    }
}
