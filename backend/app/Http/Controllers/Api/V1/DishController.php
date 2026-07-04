<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDishRequest;
use App\Http\Requests\UpdateDishRequest;
use App\Http\Resources\DishResource;
use App\Models\Dish;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DishController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Dish::with(['category', 'variantGroups.options']);
        if ($request->has('category_id')) $q->where('category_id', $request->category_id);
        if ($request->has('is_active'))   $q->where('is_active', $request->boolean('is_active'));
        if ($request->has('department')) {
            $q->whereHas('category', function ($cq) use ($request) {
                is_array($request->department)
                    ? $cq->whereIn('department', $request->department)
                    : $cq->where('department', $request->department);
            });
        }
        return DishResource::collection($q->orderBy('name')->get());
    }

    public function show(Dish $dish): DishResource
    {
        $dish->load(['category', 'defaultIngredients', 'availableAdditions', 'variantGroups.options']);
        return new DishResource($dish);
    }

    public function store(StoreDishRequest $request): DishResource
    {
        $dish = Dish::create($request->safe()->except(['ingredients', 'variant_group_ids']));

        if ($request->has('ingredients')) {
            $sync = collect($request->ingredients)->mapWithKeys(fn($i) => [
                $i['ingredient_id'] => ['is_default' => $i['is_default'] ?? true]
            ]);
            $dish->ingredients()->sync($sync);
        }

        if ($request->has('variant_group_ids')) {
            $dish->variantGroups()->sync($request->input('variant_group_ids', []));
        }

        $this->logActivity('DISH_CREATED', "Piatto '{$dish->name}' creato", $dish);
        return new DishResource($dish->load(['category', 'defaultIngredients', 'availableAdditions', 'variantGroups.options']));
    }

    public function update(UpdateDishRequest $request, Dish $dish): DishResource
    {
        $dish->update($request->safe()->except(['ingredients', 'variant_group_ids']));

        if ($request->has('ingredients')) {
            $sync = collect($request->ingredients)->mapWithKeys(fn($i) => [
                $i['ingredient_id'] => ['is_default' => $i['is_default'] ?? true]
            ]);
            $dish->ingredients()->sync($sync);
        }

        if ($request->has('variant_group_ids')) {
            $dish->variantGroups()->sync($request->input('variant_group_ids', []));
        }

        $this->logActivity('DISH_UPDATED', "Piatto '{$dish->name}' aggiornato", $dish);
        return new DishResource($dish->fresh(['category', 'defaultIngredients', 'availableAdditions', 'variantGroups.options']));
    }

    public function destroy(Dish $dish): JsonResponse
    {
        $this->logActivity('DISH_DELETED', "Piatto '{$dish->name}' eliminato", $dish);
        $dish->delete();
        return response()->json(null, 204);
    }

    public function toggle(Dish $dish): DishResource
    {
        $dish->update(['is_active' => !$dish->is_active]);
        $this->logActivity('DISH_TOGGLED',
            "Piatto '{$dish->name}' " . ($dish->is_active ? 'attivato' : 'disattivato'),
            $dish
        );
        return new DishResource($dish);
    }
}
