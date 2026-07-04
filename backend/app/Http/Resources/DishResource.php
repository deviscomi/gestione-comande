<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DishResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'name'                => $this->name,
            'description'         => $this->description,
            'price'               => $this->price,
            'category_id'         => $this->category_id,
            'category'            => new CategoryResource($this->whenLoaded('category')),
            'is_active'           => $this->is_active,
            'default_ingredients' => IngredientResource::collection($this->whenLoaded('defaultIngredients')),
            'available_additions' => IngredientResource::collection($this->whenLoaded('availableAdditions')),
            'variant_groups'      => DishVariantGroupResource::collection($this->whenLoaded('variantGroups')),
        ];
    }
}
