<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'table_id'      => $this->table_id,
            'user_id'       => $this->user_id,
            'covers'        => $this->covers,
            'coperto_price' => $this->coperto_price ?? '0.00',
            'coperto_total' => $this->copertoTotal(),
            'pending_count' => $this->pending_count ?? 0,
            'order_number'  => $this->order_number,
            'status'        => $this->status,
            'total'         => $this->total,
            'opened_at'     => $this->opened_at,
            'first_sent_at' => $this->first_sent_at,
            'closed_at'     => $this->closed_at,
            'table'         => new TableResource($this->whenLoaded('table')),
            'items'         => OrderItemResource::collection($this->whenLoaded('items')),
            'sends'         => OrderSendResource::collection($this->whenLoaded('sends')),
        ];
    }
}
