<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePizzaVariantRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'      => 'required|string|max:100',
            'code'      => 'required|string|max:20|unique:pizza_variants,code',
            'price_add' => 'required|numeric|min:0',
            'is_active' => 'boolean',
        ];
    }
}
