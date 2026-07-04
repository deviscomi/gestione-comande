<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IngredientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                      => $this->id,
            'name'                    => $this->name,
            'department'              => $this->department,
            'ingredient_category_id'  => $this->ingredient_category_id,
            'category_name'           => $this->whenLoaded('category', fn () => $this->category?->name),
            'price_add'               => $this->price_add,
            'price_remove'            => $this->price_remove,
            'is_active'               => $this->is_active,
        ];
    }
}
