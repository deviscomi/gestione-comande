<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateIngredientRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'         => 'sometimes|string|max:100',
            'department'   => 'sometimes|in:cucina,bar,pizzeria,vini',
            'ingredient_category_id' => 'nullable|exists:ingredient_categories,id',
            'price_add'    => 'sometimes|numeric|min:0',
            'price_remove' => 'sometimes|numeric|min:0',
            'is_active'    => 'sometimes|boolean',
        ];
    }
}
