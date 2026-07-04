<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIngredientRequest;
use App\Http\Requests\UpdateIngredientRequest;
use App\Http\Resources\IngredientResource;
use App\Models\Ingredient;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class IngredientController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Ingredient::query()->with('category');
        if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
        if ($request->has('ingredient_category_id')) $q->where('ingredient_category_id', $request->ingredient_category_id);
        if ($request->has('department')) $q->where('department', $request->department);
        return IngredientResource::collection($q->orderBy('name')->get());
    }

    public function show(Ingredient $ingredient): IngredientResource
    {
        return new IngredientResource($ingredient);
    }

    public function store(StoreIngredientRequest $request): IngredientResource
    {
        $ingredient = Ingredient::create($request->validated());
        $this->logActivity('INGREDIENT_CREATED', "Ingrediente '{$ingredient->name}' creato", $ingredient);
        return new IngredientResource($ingredient);
    }

    public function update(UpdateIngredientRequest $request, Ingredient $ingredient): IngredientResource
    {
        $ingredient->update($request->validated());
        $this->logActivity('INGREDIENT_UPDATED', "Ingrediente '{$ingredient->name}' aggiornato", $ingredient);
        return new IngredientResource($ingredient);
    }

    public function destroy(Ingredient $ingredient): JsonResponse
    {
        if ($ingredient->dishes()->exists()) {
            return response()->json(['message' => 'Ingrediente in uso da piatti esistenti'], 422);
        }
        $this->logActivity('INGREDIENT_DELETED', "Ingrediente '{$ingredient->name}' eliminato", $ingredient);
        $ingredient->delete();
        return response()->json(null, 204);
    }

    public function toggle(Ingredient $ingredient): IngredientResource
    {
        $ingredient->update(['is_active' => !$ingredient->is_active]);
        $this->logActivity('INGREDIENT_TOGGLED',
            "Ingrediente '{$ingredient->name}' " . ($ingredient->is_active ? 'attivato' : 'disattivato'),
            $ingredient
        );
        return new IngredientResource($ingredient);
    }
}
