<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIngredientCategoryRequest;
use App\Http\Requests\UpdateIngredientCategoryRequest;
use App\Http\Resources\IngredientCategoryResource;
use App\Models\IngredientCategory;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class IngredientCategoryController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = IngredientCategory::query();
        if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
        if ($request->has('department')) $q->where('department', $request->department);
        return IngredientCategoryResource::collection($q->orderBy('sort_order')->get());
    }

    public function show(IngredientCategory $ingredientCategory): IngredientCategoryResource
    {
        return new IngredientCategoryResource($ingredientCategory);
    }

    public function store(StoreIngredientCategoryRequest $request): IngredientCategoryResource
    {
        $ingredientCategory = IngredientCategory::create($request->validated());
        $this->logActivity('INGREDIENT_CATEGORY_CREATED', "Categoria ingrediente '{$ingredientCategory->name}' creata", $ingredientCategory);
        return new IngredientCategoryResource($ingredientCategory);
    }

    public function update(UpdateIngredientCategoryRequest $request, IngredientCategory $ingredientCategory): IngredientCategoryResource
    {
        $ingredientCategory->update($request->validated());
        $this->logActivity('INGREDIENT_CATEGORY_UPDATED', "Categoria ingrediente '{$ingredientCategory->name}' aggiornata", $ingredientCategory);
        return new IngredientCategoryResource($ingredientCategory);
    }

    public function destroy(IngredientCategory $ingredientCategory): JsonResponse
    {
        if ($ingredientCategory->ingredients()->exists()) {
            return response()->json(['message' => 'Impossibile eliminare: categoria con ingredienti associati'], 422);
        }
        $this->logActivity('INGREDIENT_CATEGORY_DELETED', "Categoria ingrediente '{$ingredientCategory->name}' eliminata", $ingredientCategory);
        $ingredientCategory->delete();
        return response()->json(null, 204);
    }

    public function toggle(IngredientCategory $ingredientCategory): IngredientCategoryResource
    {
        $ingredientCategory->update(['is_active' => !$ingredientCategory->is_active]);
        $this->logActivity('INGREDIENT_CATEGORY_TOGGLED',
            "Categoria ingrediente '{$ingredientCategory->name}' " . ($ingredientCategory->is_active ? 'attivata' : 'disattivata'),
            $ingredientCategory
        );
        return new IngredientCategoryResource($ingredientCategory);
    }
}
