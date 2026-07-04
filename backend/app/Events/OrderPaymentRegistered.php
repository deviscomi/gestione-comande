<?php

namespace App\Events;

use App\Models\Order;
use App\Models\OrderPayment;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderPaymentRegistered implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order, public OrderPayment $payment) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("orders.{$this->order->id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'order.payment-registered';
    }

    public function broadcastWith(): array
    {
        return [
            'order_id'   => $this->order->id,
            'payment_id' => $this->payment->id,
            'amount'     => $this->payment->amount,
            'status'     => $this->payment->status,
            'is_settled' => $this->order->isFullySettled(),
        ];
    }
}
