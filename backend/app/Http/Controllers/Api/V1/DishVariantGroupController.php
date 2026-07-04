<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDishVariantGroupRequest;
use App\Http\Requests\UpdateDishVariantGroupRequest;
use App\Http\Resources\DishVariantGroupResource;
use App\Models\DishVariantGroup;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DishVariantGroupController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = DishVariantGroup::with('options');
        if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
        if ($request->has('department')) $q->where('department', $request->department);
        return DishVariantGroupResource::collection($q->orderBy('sort_order')->get());
    }

    public function show(DishVariantGroup $dishVariantGroup): DishVariantGroupResource
    {
        return new DishVariantGroupResource($dishVariantGroup->load('options'));
    }

    public function store(StoreDishVariantGroupRequest $request): DishVariantGroupResource
    {
        $group = DishVariantGroup::create($request->safe()->except('options'));

        $this->syncOptions($group, $request->input('options', []));

        $this->logActivity('DISH_VARIANT_GROUP_CREATED', "Gruppo variante '{$group->name}' creato", $group);
        return new DishVariantGroupResource($group->load('options'));
    }

    public function update(UpdateDishVariantGroupRequest $request, DishVariantGroup $dishVariantGroup): DishVariantGroupResource
    {
        $dishVariantGroup->update($request->safe()->except('options'));

        if ($request->has('options')) {
            $this->syncOptions($dishVariantGroup, $request->input('options', []));
        }

        $this->logActivity('DISH_VARIANT_GROUP_UPDATED', "Gruppo variante '{$dishVariantGroup->name}' aggiornato", $dishVariantGroup);
        return new DishVariantGroupResource($dishVariantGroup->fresh('options'));
    }

    public function destroy(DishVariantGroup $dishVariantGroup): JsonResponse
    {
        $this->logActivity('DISH_VARIANT_GROUP_DELETED', "Gruppo variante '{$dishVariantGroup->name}' eliminato", $dishVariantGroup);
        $dishVariantGroup->delete();
        return response()->json(null, 204);
    }

    public function toggle(DishVariantGroup $dishVariantGroup): DishVariantGroupResource
    {
        $dishVariantGroup->update(['is_active' => !$dishVariantGroup->is_active]);
        $this->logActivity('DISH_VARIANT_GROUP_TOGGLED',
            "Gruppo variante '{$dishVariantGroup->name}' " . ($dishVariantGroup->is_active ? 'attivato' : 'disattivato'),
            $dishVariantGroup
        );
        return new DishVariantGroupResource($dishVariantGroup);
    }

    private function syncOptions(DishVariantGroup $group, array $options): void
    {
        $keptIds = [];

        foreach ($options as $option) {
            $data = [
                'name'      => $option['name'],
                'price_add' => $option['price_add'],
            ];

            if (!empty($option['id'])) {
                $group->options()->where('id', $option['id'])->update($data);
                $keptIds[] = $option['id'];
            } else {
                $created = $group->options()->create($data);
                $keptIds[] = $created->id;
            }
        }

        $group->options()->whereNotIn('id', $keptIds)->delete();
    }
}
