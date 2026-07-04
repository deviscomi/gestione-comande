<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrinterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'department' => $this->department,
            'ip_address' => $this->ip_address,
            'port'       => $this->port,
            'is_active'  => $this->is_active,
        ];
    }
}
