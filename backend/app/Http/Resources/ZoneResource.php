<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ZoneResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'is_outdoor' => $this->is_outdoor,
            'is_enabled' => $this->is_enabled,
            'sort_order' => $this->sort_order,
            'tables'     => TableResource::collection($this->whenLoaded('tables')),
        ];
    }
}
