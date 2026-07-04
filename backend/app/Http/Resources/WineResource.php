<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WineResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'name'         => $this->name,
            'producer'     => $this->producer,
            'vintage_year' => $this->vintage_year,
            'price'        => $this->price,
            'description'  => $this->description,
            'category_id'  => $this->category_id,
            'category'     => new CategoryResource($this->whenLoaded('category')),
            'is_active'    => $this->is_active,
            'variant_groups' => DishVariantGroupResource::collection($this->whenLoaded('variantGroups')),
        ];
    }
}
