<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'user_id'     => $this->user_id,
            'user'        => new UserResource($this->whenLoaded('user')),
            'action'      => $this->action,
            'description' => $this->description,
            'entity_type' => $this->entity_type,
            'entity_id'   => $this->entity_id,
            'ip_address'  => $this->ip_address,
            'created_at'  => $this->created_at,
        ];
    }
}
