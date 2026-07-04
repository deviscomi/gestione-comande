<?php

namespace App\Events;

use App\Models\Order;
use App\Models\OrderSend;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order, public OrderSend $orderSend) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("orders.{$this->order->id}"),
            new PrivateChannel('admin.dashboard'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'order.sent';
    }

    public function broadcastWith(): array
    {
        return [
            'order_id'    => $this->order->id,
            'order_number'=> $this->order->order_number,
            'send_id'     => $this->orderSend->id,
            'send_number' => $this->orderSend->send_number,
            'table_id'    => $this->order->table_id,
        ];
    }
}
