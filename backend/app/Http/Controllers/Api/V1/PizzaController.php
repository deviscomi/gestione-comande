<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePizzaRequest;
use App\Http\Requests\UpdatePizzaRequest;
use App\Http\Resources\PizzaResource;
use App\Models\Pizza;
use App\Models\PizzaIngredient;
use App\Models\PizzaVariant;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PizzaController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Pizza::query();
        if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
        return PizzaResource::collection($q->with('defaultIngredients')->orderBy('name')->get());
    }

    public function show(Pizza $pizza): JsonResponse
    {
        $pizza->load('defaultIngredients');
        $defaultIds = $pizza->defaultIngredients->pluck('id');

        $availableAdditions = PizzaIngredient::where('is_active', true)
            ->whereNotIn('id', $defaultIds)
            ->orderBy('name')
            ->get();

        $variants = PizzaVariant::where('is_active', true)->orderBy('name')->get();

        return response()->json([
            'id'                  => $pizza->id,
            'name'                => $pizza->name,
            'description'         => $pizza->description,
            'base_price'          => $pizza->base_price,
            'is_active'           => $pizza->is_active,
            'default_base'        => $pizza->default_base,
            'default_ingredients' => $pizza->defaultIngredients,
            'available_additions' => $availableAdditions,
            'variants'            => $variants,
        ]);
    }

    public function store(StorePizzaRequest $request): JsonResponse
    {
        $pizza = Pizza::create($request->safe()->except('default_ingredients'));

        if ($request->has('default_ingredients')) {
            $pizza->defaultIngredients()->sync($request->default_ingredients);
        }

        $this->logActivity('PIZZA_CREATED', "Pizza '{$pizza->name}' creata", $pizza);
        return response()->json(new PizzaResource($pizza->load('defaultIngredients')), 201);
    }

    public function update(UpdatePizzaRequest $request, Pizza $pizza): JsonResponse
    {
        $pizza->update($request->safe()->except('default_ingredients'));

        if ($request->has('default_ingredients')) {
            $pizza->defaultIngredients()->sync($request->default_ingredients);
        }

        return response()->json(new PizzaResource($pizza->fresh('defaultIngredients')));
    }

    public function destroy(Pizza $pizza): JsonResponse
    {
        $this->logActivity('PIZZA_DELETED', "Pizza '{$pizza->name}' eliminata", $pizza);
        $pizza->delete();
        return response()->json(null, 204);
    }

    public function toggle(Pizza $pizza): JsonResponse
    {
        $pizza->update(['is_active' => !$pizza->is_active]);
        $this->logActivity('PIZZA_TOGGLED',
            "Pizza '{$pizza->name}' " . ($pizza->is_active ? 'attivata' : 'disattivata'),
            $pizza
        );
        return response()->json(new PizzaResource($pizza));
    }
}
