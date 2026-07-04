<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreZoneRequest;
use App\Http\Requests\UpdateZoneRequest;
use App\Http\Resources\ZoneResource;
use App\Models\Zone;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ZoneController extends Controller
{
    use LogsActivity;

    public function index(): AnonymousResourceCollection
    {
        $withActiveOrder = fn($q) => $q->withCount([
            'items as pending_count' => fn($q) => $q->where('status', 'pending'),
        ]);

        return ZoneResource::collection(
            Zone::with([
                'tables' => fn($q) => $q
                    ->with([
                        'activeOrder' => $withActiveOrder,
                        'children'    => fn($q) => $q->with(['activeOrder' => $withActiveOrder]),
                    ])
                    ->orderBy('number'),
            ])
            ->orderBy('sort_order')
            ->get()
        );
    }

    public function show(Zone $zone): ZoneResource
    {
        $zone->load(['tables' => fn($q) => $q->with('children')->orderBy('number')]);
        return new ZoneResource($zone);
    }

    public function store(StoreZoneRequest $request): ZoneResource
    {
        $zone = Zone::create(array_merge($request->validated(), ['is_enabled' => true]));
        $this->logActivity('ZONE_CREATED', "Zona '{$zone->name}' creata", $zone);
        return new ZoneResource($zone);
    }

    public function update(UpdateZoneRequest $request, Zone $zone): ZoneResource
    {
        $zone->update($request->validated());
        return new ZoneResource($zone);
    }

    public function destroy(Zone $zone): JsonResponse
    {
        if ($zone->tables()->where('status', '!=', 'libero')->exists()) {
            return response()->json(['message' => 'Impossibile eliminare: la zona contiene tavoli non liberi'], 422);
        }

        // Elimina tavoli liberi e poi la zona nella stessa transaction
        // (FK tables.zone_id ha RESTRICT: senza delete preventivo la query fallirebbe)
        DB::transaction(function () use ($zone) {
            $zone->tables()->delete();
            $zone->delete();
        });

        return response()->json(null, 204);
    }

    public function toggle(Zone $zone): ZoneResource|JsonResponse
    {
        // Il cameriere può agire soltanto sulle zone esterne (is_outdoor = 1)
        if (auth()->user()->role === 'waiter' && ! $zone->is_outdoor) {
            return response()->json(['message' => 'Non autorizzato: il cameriere può agire solo sulle zone esterne'], 403);
        }

        $zone->update(['is_enabled' => ! $zone->is_enabled]);
        $this->logActivity('ZONE_TOGGLED',
            "Zona '{$zone->name}' " . ($zone->is_enabled ? 'abilitata' : 'disabilitata'),
            $zone
        );
        return new ZoneResource($zone);
    }
}
