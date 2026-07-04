<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePizzaRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                  => 'sometimes|string|max:150',
            'description'           => 'nullable|string',
            'base_price'            => 'sometimes|numeric|min:0',
            'is_active'             => 'sometimes|boolean',
            'default_base'          => 'sometimes|nullable|string|in:M,Rose\',R,B,S',
            'default_ingredients'   => 'nullable|array',
            'default_ingredients.*' => 'exists:pizza_ingredients,id',
        ];
    }
}
