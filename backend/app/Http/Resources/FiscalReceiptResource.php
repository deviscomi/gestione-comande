<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FiscalReceiptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'order_payment_id'      => $this->order_payment_id,
            'fiscal_device_id'      => $this->fiscal_device_id,
            'fiscal_status'         => $this->fiscal_status,
            'fiscal_receipt_number' => $this->fiscal_receipt_number,
            'lottery_code'          => $this->lottery_code,
            'fiscal_emitted_at'     => $this->fiscal_emitted_at,
            'fiscal_error_message'  => $this->fiscal_error_message,
            'attempts'              => $this->attempts,
        ];
    }
}
