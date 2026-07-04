<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePrinterRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'       => 'required|string|max:100',
            'department' => 'required|in:cassiere,cucina,pizzeria,bar',
            'ip_address' => 'required|ip',
            'port'       => 'integer|min:1|max:65535',
            'is_active'  => 'boolean',
        ];
    }
}
