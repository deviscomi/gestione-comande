<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Log;

class StoreFiscalDeviceRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    protected function prepareForValidation(): void
    {
        Log::debug('DEBUG_FISCAL_DEVICE_RAW_INPUT', [
            'all'      => $this->all(),
            'isJson'   => $this->isJson(),
            'content'  => $this->getContent(),
        ]);

        // Il form invia sempre tutti i campi anche quando non rilevanti per il
        // connection_type selezionato (es. base_url quando si usa lan_tcp): senza
        // questa normalizzazione 'nullable' non basta, perché si applica solo a
        // null e non alla stringa vuota, facendo fallire le regole 'ip'/'url'.
        $optional = ['ip_address', 'port', 'base_url', 'auth_token', 'fiscal_serial_number', 'vat_number', 'notes'];

        $this->merge(
            collect($optional)
                ->mapWithKeys(fn ($field) => [$field => $this->input($field) === '' ? null : $this->input($field)])
                ->all()
        );
    }

    public function rules(): array
    {
        return [
            'name'                  => 'required|string|max:100',
            'driver'                => 'required|in:epson_fp,custom,rch_webservice,generic_http,generic_bridge',
            'connection_type'       => 'required|in:lan_tcp,http_webservice,local_bridge',
            'ip_address'            => 'required_if:connection_type,lan_tcp|nullable|ip',
            'port'                  => 'required_if:connection_type,lan_tcp|nullable|integer|min:1|max:65535',
            'base_url'              => 'required_if:connection_type,http_webservice,local_bridge|nullable|url',
            'auth_token'            => 'nullable|string',
            'fiscal_serial_number'  => 'nullable|string|max:50',
            'vat_number'            => 'nullable|string|max:20',
            'is_active'             => 'boolean',
            'notes'                 => 'nullable|string',
        ];
    }
}
