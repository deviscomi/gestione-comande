<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDishRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                        => 'sometimes|string|max:150',
            'description'                 => 'nullable|string',
            'price'                       => 'sometimes|numeric|min:0',
            'category_id'                 => 'sometimes|exists:categories,id',
            'is_active'                   => 'sometimes|boolean',
            'ingredients'                 => 'nullable|array',
            'ingredients.*.ingredient_id' => 'required|exists:ingredients,id',
            'ingredients.*.is_default'    => 'boolean',
            'variant_group_ids'           => 'nullable|array',
            'variant_group_ids.*'         => 'exists:dish_variant_groups,id',
        ];
    }
}
