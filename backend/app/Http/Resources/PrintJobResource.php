<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrintJobResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'print_type' => $this->print_type,
            'status'     => $this->status,
            'attempts'   => $this->attempts,
            'created_at' => $this->created_at,
            'printed_at' => $this->printed_at,
        ];
    }
}
