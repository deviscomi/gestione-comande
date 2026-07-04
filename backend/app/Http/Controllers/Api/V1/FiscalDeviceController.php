<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFiscalDeviceRequest;
use App\Http\Resources\FiscalDeviceResource;
use App\Models\FiscalDevice;
use App\Services\Fiscal\FiscalDriverFactory;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use RuntimeException;

class FiscalDeviceController extends Controller
{
    use LogsActivity;

    public function index(): AnonymousResourceCollection
    {
        return FiscalDeviceResource::collection(FiscalDevice::orderBy('name')->get());
    }

    public function show(FiscalDevice $fiscalDevice): FiscalDeviceResource
    {
        return new FiscalDeviceResource($fiscalDevice);
    }

    public function store(StoreFiscalDeviceRequest $request): JsonResponse
    {
        $device = FiscalDevice::create($request->validated());
        $this->logActivity('FISCAL_DEVICE_CREATED', "Registratore telematico '{$device->name}' aggiunto", $device);
        return response()->json(new FiscalDeviceResource($device), 201);
    }

    public function update(StoreFiscalDeviceRequest $request, FiscalDevice $fiscalDevice): FiscalDeviceResource
    {
        $fiscalDevice->update($request->validated());
        $this->logActivity('FISCAL_DEVICE_UPDATED', "Registratore telematico '{$fiscalDevice->name}' aggiornato", $fiscalDevice);
        return new FiscalDeviceResource($fiscalDevice->fresh());
    }

    public function destroy(FiscalDevice $fiscalDevice): JsonResponse
    {
        $this->logActivity('FISCAL_DEVICE_DELETED', "Registratore telematico '{$fiscalDevice->name}' eliminato", $fiscalDevice);
        $fiscalDevice->delete();
        return response()->json(null, 204);
    }

    public function toggle(FiscalDevice $fiscalDevice): FiscalDeviceResource
    {
        $fiscalDevice->update(['is_active' => ! $fiscalDevice->is_active]);
        return new FiscalDeviceResource($fiscalDevice);
    }

    public function test(FiscalDevice $fiscalDevice): JsonResponse
    {
        try {
            $result = FiscalDriverFactory::make($fiscalDevice->driver)->testConnection($fiscalDevice);
        } catch (RuntimeException $e) {
            $this->logActivity('FISCAL_DEVICE_TEST', "Test connessione '{$fiscalDevice->name}' non disponibile: {$e->getMessage()}", $fiscalDevice);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 503);
        }

        $this->logActivity('FISCAL_DEVICE_TEST', "Test connessione '{$fiscalDevice->name}' eseguito", $fiscalDevice);

        return response()->json([
            'success' => $result->success,
            'message' => $result->success ? 'Connessione riuscita' : ($result->errorMessage ?? 'Connessione fallita'),
        ], $result->success ? 200 : 503);
    }
}
