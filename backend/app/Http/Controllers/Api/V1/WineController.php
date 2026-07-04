<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWineRequest;
use App\Http\Requests\UpdateWineRequest;
use App\Http\Resources\WineResource;
use App\Models\Wine;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WineController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Wine::with(['category', 'variantGroups.options']);
        if ($request->has('category_id')) $q->where('category_id', $request->category_id);
        if ($request->has('is_active'))   $q->where('is_active', $request->boolean('is_active'));
        return WineResource::collection($q->orderBy('name')->get());
    }

    public function show(Wine $wine): WineResource
    {
        return new WineResource($wine->load(['category', 'variantGroups.options']));
    }

    public function store(StoreWineRequest $request): WineResource
    {
        $wine = Wine::create($request->safe()->except('variant_group_ids'));

        if ($request->has('variant_group_ids')) {
            $wine->variantGroups()->sync($request->input('variant_group_ids', []));
        }

        $this->logActivity('WINE_CREATED', "Vino '{$wine->name}' creato", $wine);
        return new WineResource($wine->load(['category', 'variantGroups.options']));
    }

    public function update(UpdateWineRequest $request, Wine $wine): WineResource
    {
        $wine->update($request->safe()->except('variant_group_ids'));

        if ($request->has('variant_group_ids')) {
            $wine->variantGroups()->sync($request->input('variant_group_ids', []));
        }

        $this->logActivity('WINE_UPDATED', "Vino '{$wine->name}' aggiornato", $wine);
        return new WineResource($wine->fresh(['category', 'variantGroups.options']));
    }

    public function destroy(Wine $wine): JsonResponse
    {
        $this->logActivity('WINE_DELETED', "Vino '{$wine->name}' eliminato", $wine);
        $wine->delete();
        return response()->json(null, 204);
    }

    public function toggle(Wine $wine): WineResource
    {
        $wine->update(['is_active' => !$wine->is_active]);
        $this->logActivity('WINE_TOGGLED',
            "Vino '{$wine->name}' " . ($wine->is_active ? 'attivato' : 'disattivato'),
            $wine
        );
        return new WineResource($wine);
    }
}
