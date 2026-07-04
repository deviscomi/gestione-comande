<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePizzaVariantRequest;
use App\Http\Requests\UpdatePizzaVariantRequest;
use App\Http\Resources\PizzaVariantResource;
use App\Models\PizzaVariant;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PizzaVariantController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = PizzaVariant::query();
        if ($request->has('is_active')) $q->where('is_active', $request->boolean('is_active'));
        return PizzaVariantResource::collection($q->orderBy('name')->get());
    }

    public function show(PizzaVariant $pizzaVariant): PizzaVariantResource
    {
        return new PizzaVariantResource($pizzaVariant);
    }

    public function store(StorePizzaVariantRequest $request): PizzaVariantResource
    {
        $variant = PizzaVariant::create($request->validated());
        $this->logActivity('PIZZA_VARIANT_CREATED', "Variante pizza '{$variant->name}' creata", $variant);
        return new PizzaVariantResource($variant);
    }

    public function update(UpdatePizzaVariantRequest $request, PizzaVariant $pizzaVariant): PizzaVariantResource
    {
        $pizzaVariant->update($request->validated());
        return new PizzaVariantResource($pizzaVariant);
    }

    public function destroy(PizzaVariant $pizzaVariant): JsonResponse
    {
        $pizzaVariant->delete();
        return response()->json(null, 204);
    }

    public function toggle(PizzaVariant $pizzaVariant): PizzaVariantResource
    {
        $pizzaVariant->update(['is_active' => !$pizzaVariant->is_active]);
        return new PizzaVariantResource($pizzaVariant);
    }
}
