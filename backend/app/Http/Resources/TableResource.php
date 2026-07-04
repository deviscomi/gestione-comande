<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TableResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'zone_id'         => $this->zone_id,
            'parent_table_id' => $this->parent_table_id,
            'number'          => $this->number,
            'suffix'          => $this->suffix,
            'status'          => $this->status,
            'zone'            => new ZoneResource($this->whenLoaded('zone')),
            'active_order'    => $this->when(
                $this->resource->relationLoaded('activeOrder'),
                fn() => $this->resource->activeOrder ? new OrderResource($this->resource->activeOrder) : null
            ),
            'children'        => TableResource::collection($this->whenLoaded('children')),
        ];
    }
}
