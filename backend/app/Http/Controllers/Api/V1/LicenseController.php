<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LicenseController extends Controller
{
    // GET /api/v1/license — accessibile da tutti i ruoli autenticati
    public function show(LicenseService $license): JsonResponse
    {
        $lic = $license->getLicense();

        return response()->json([
            'licensee_name' => $lic->licensee_name,
            'tier'          => $lic->tier,
            'expires_at'    => $lic->expires_at?->toISOString(),
            'is_expired'    => $lic->isExpired(),
            'modules'       => $license->activeModules(),
        ]);
    }

    // PUT /api/v1/license — solo admin (vendor use)
    public function update(Request $request, LicenseService $license): JsonResponse
    {
        $data = $request->validate([
            'licensee_name' => 'sometimes|string|max:255',
            'tier'          => 'sometimes|string|max:64',
            'license_key'   => 'sometimes|nullable|string|max:255',
            'expires_at'    => 'sometimes|nullable|date',
            'notes'         => 'sometimes|nullable|string',
        ]);

        $lic = $license->getLicense();
        $lic->update($data);
        $license->flushCache();

        return response()->json([
            'licensee_name' => $lic->licensee_name,
            'tier'          => $lic->tier,
            'expires_at'    => $lic->expires_at?->toISOString(),
            'is_expired'    => $lic->isExpired(),
            'modules'       => $license->activeModules(),
        ]);
    }
}
