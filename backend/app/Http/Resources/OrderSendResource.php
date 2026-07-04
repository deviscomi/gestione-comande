<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderSendResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'order_id'    => $this->order_id,
            'send_number' => $this->send_number,
            'sent_at'     => $this->sent_at,
            'items'       => OrderItemResource::collection($this->whenLoaded('items')),
            'print_jobs'  => PrintJobResource::collection($this->whenLoaded('printJobs')),
        ];
    }
}
