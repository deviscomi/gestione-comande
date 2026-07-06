<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PizzaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'category_id'         => $this->category_id,
            'name'                => $this->name,
            'description'         => $this->description,
            'base_price'          => $this->base_price,
            'is_active'           => $this->is_active,
            'default_base'        => $this->default_base,
            'default_ingredients' => PizzaIngredientResource::collection($this->whenLoaded('defaultIngredients')),
        ];
    }
}
