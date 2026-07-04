<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DishVariantOptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'        => $this->id,
            'name'      => $this->name,
            'price_add' => $this->price_add,
            'is_active' => $this->is_active,
            'sort_order'=> $this->sort_order,
        ];
    }
}
