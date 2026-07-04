<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DishVariantGroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'department'  => $this->department,
            'is_required' => $this->is_required,
            'is_active'   => $this->is_active,
            'sort_order'  => $this->sort_order,
            'options'     => DishVariantOptionResource::collection($this->whenLoaded('options')),
        ];
    }
}
