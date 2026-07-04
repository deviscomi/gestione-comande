<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePizzaIngredientRequest;
use App\Http\Requests\UpdatePizzaIngredientRequest;
use App\Http\Resources\PizzaIngredientResource;
use App\Models\PizzaIngredient;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PizzaIngredientController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = PizzaIngredient::query();
        if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
        return PizzaIngredientResource::collection($q->orderBy('name')->get());
    }

    public function show(PizzaIngredient $pizzaIngredient): PizzaIngredientResource
    {
        return new PizzaIngredientResource($pizzaIngredient);
    }

    public function store(StorePizzaIngredientRequest $request): PizzaIngredientResource
    {
        $ingredient = PizzaIngredient::create($request->validated());
        $this->logActivity('PIZZA_INGREDIENT_CREATED', "Ingrediente pizza '{$ingredient->name}' creato", $ingredient);
        return new PizzaIngredientResource($ingredient);
    }

    public function update(UpdatePizzaIngredientRequest $request, PizzaIngredient $pizzaIngredient): PizzaIngredientResource
    {
        $pizzaIngredient->update($request->validated());
        return new PizzaIngredientResource($pizzaIngredient);
    }

    public function destroy(PizzaIngredient $pizzaIngredient): JsonResponse
    {
        $pizzaIngredient->delete();
        return response()->json(null, 204);
    }

    public function toggle(PizzaIngredient $pizzaIngredient): PizzaIngredientResource
    {
        $pizzaIngredient->update(['is_active' => !$pizzaIngredient->is_active]);
        return new PizzaIngredientResource($pizzaIngredient);
    }
}
