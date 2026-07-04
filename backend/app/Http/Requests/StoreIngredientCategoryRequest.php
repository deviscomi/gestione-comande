<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreIngredientCategoryRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'       => 'required|string|max:100',
            'department' => 'required|in:cucina,bar,pizzeria,vini',
            'sort_order' => 'integer|min:0',
            'is_active'  => 'boolean',
        ];
    }
}
