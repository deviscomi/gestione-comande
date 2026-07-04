<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePizzaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                  => 'required|string|max:150',
            'description'           => 'nullable|string',
            'base_price'            => 'required|numeric|min:0',
            'is_active'             => 'boolean',
            'default_base'          => 'nullable|string|in:M,Rose\',R,B,S',
            'default_ingredients'   => 'nullable|array',
            'default_ingredients.*' => 'exists:pizza_ingredients,id',
        ];
    }
}
