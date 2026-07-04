<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreWineQuantityRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'       => 'required|string|max:50',
            'price_add'  => 'required|numeric|min:0',
            'sort_order' => 'integer|min:0',
            'is_active'  => 'boolean',
        ];
    }
}
