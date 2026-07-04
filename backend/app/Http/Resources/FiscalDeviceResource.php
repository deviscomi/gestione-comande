<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FiscalDeviceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'name'                  => $this->name,
            'driver'                => $this->driver,
            'connection_type'       => $this->connection_type,
            'ip_address'            => $this->ip_address,
            'port'                  => $this->port,
            'base_url'              => $this->base_url,
            'has_auth_token'        => ! empty($this->auth_token),
            'fiscal_serial_number'  => $this->fiscal_serial_number,
            'vat_number'            => $this->vat_number,
            'is_active'             => $this->is_active,
            'notes'                 => $this->notes,
        ];
    }
}
