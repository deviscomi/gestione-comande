<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWineQuantityRequest;
use App\Http\Requests\UpdateWineQuantityRequest;
use App\Http\Resources\WineQuantityResource;
use App\Models\WineQuantity;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WineQuantityController extends Controller
{
    use LogsActivity;

    public function index(): AnonymousResourceCollection
    {
        return WineQuantityResource::collection(WineQuantity::orderBy('sort_order')->get());
    }

    public function store(StoreWineQuantityRequest $request): WineQuantityResource
    {
        $wineQuantity = WineQuantity::create($request->validated());
        $this->logActivity('WINE_QUANTITY_CREATED', "Formato vino '{$wineQuantity->name}' creato", $wineQuantity);
        return new WineQuantityResource($wineQuantity);
    }

    public function update(UpdateWineQuantityRequest $request, WineQuantity $wineQuantity): WineQuantityResource
    {
        $wineQuantity->update($request->validated());
        $this->logActivity('WINE_QUANTITY_UPDATED', "Formato vino '{$wineQuantity->name}' aggiornato", $wineQuantity);
        return new WineQuantityResource($wineQuantity);
    }

    public function destroy(WineQuantity $wineQuantity): JsonResponse
    {
        $this->logActivity('WINE_QUANTITY_DELETED', "Formato vino '{$wineQuantity->name}' eliminato", $wineQuantity);
        $wineQuantity->delete();
        return response()->json(null, 204);
    }

    public function toggle(WineQuantity $wineQuantity): WineQuantityResource
    {
        $wineQuantity->update(['is_active' => !$wineQuantity->is_active]);
        $this->logActivity('WINE_QUANTITY_TOGGLED',
            "Formato vino '{$wineQuantity->name}' " . ($wineQuantity->is_active ? 'attivato' : 'disattivato'),
            $wineQuantity
        );
        return new WineQuantityResource($wineQuantity);
    }
}
