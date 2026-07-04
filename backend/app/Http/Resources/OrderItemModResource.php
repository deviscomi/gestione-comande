<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemModResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'mod_type'     => $this->mod_type,
            'mod_value'    => $this->mod_value,
            'price_change' => $this->price_change,
        ];
    }
}
