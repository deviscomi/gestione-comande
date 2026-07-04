<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreIngredientRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'         => 'required|string|max:100',
            'department'   => 'required|in:cucina,bar,pizzeria,vini',
            'ingredient_category_id' => 'nullable|exists:ingredient_categories,id',
            'price_add'    => 'required|numeric|min:0',
            'price_remove' => 'required|numeric|min:0',
            'is_active'    => 'boolean',
        ];
    }
}
