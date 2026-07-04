<?php

namespace App\Events;

use App\Models\FiscalReceipt;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FiscalReceiptStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public FiscalReceipt $receipt, public int $orderId) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("orders.{$this->orderId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'fiscal.receipt-status-changed';
    }

    public function broadcastWith(): array
    {
        return [
            'order_payment_id'      => $this->receipt->order_payment_id,
            'fiscal_status'         => $this->receipt->fiscal_status,
            'fiscal_receipt_number' => $this->receipt->fiscal_receipt_number,
            'lottery_code'          => $this->receipt->lottery_code,
            'fiscal_error_message'  => $this->receipt->fiscal_error_message,
        ];
    }
}
