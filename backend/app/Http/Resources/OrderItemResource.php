<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'order_id'      => $this->order_id,
            'order_send_id' => $this->order_send_id,
            'item_type'     => $this->item_type,
            'dish_id'       => $this->dish_id,
            'pizza_id'      => $this->pizza_id,
            'wine_id'       => $this->wine_id,
            'dish'          => new DishResource($this->whenLoaded('dish')),
            'pizza'         => new PizzaResource($this->whenLoaded('pizza')),
            'wine'          => new WineResource($this->whenLoaded('wine')),
            'quantity'      => $this->quantity,
            'unit_price'    => $this->unit_price,
            'total_price'   => $this->total_price,
            'status'        => $this->status,
            'notes'         => $this->notes,
            'sort_order'    => $this->sort_order,
            'uscita'        => $this->uscita ?? 1,
            'modifications' => OrderItemModResource::collection($this->whenLoaded('modifications')),
        ];
    }
}
