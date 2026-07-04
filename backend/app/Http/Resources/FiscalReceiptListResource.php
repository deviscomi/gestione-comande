<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FiscalReceiptListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $payment = $this->orderPayment;
        $order   = $payment?->order;
        $table   = $order?->table;

        return [
            'id'                    => $this->id,
            'fiscal_status'         => $this->fiscal_status,
            'fiscal_receipt_number' => $this->fiscal_receipt_number,
            'fiscal_emitted_at'     => $this->fiscal_emitted_at,
            'fiscal_error_message'  => $this->fiscal_error_message,
            'attempts'              => $this->attempts,
            'created_at'            => $this->created_at,
            'amount'                => $payment?->amount,
            'cashier'               => $payment?->user?->name,
            'order_number'          => $order?->order_number,
            'table_label'           => $table
                ? trim("Tav {$table->number}{$table->suffix}" . ($table->zone ? " · {$table->zone->name}" : ''))
                : null,
            'device_name'           => $this->fiscalDevice?->name,
        ];
    }
}
