<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDishRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                        => 'required|string|max:150',
            'description'                 => 'nullable|string',
            'price'                       => 'required|numeric|min:0',
            'category_id'                 => 'required|exists:categories,id',
            'is_active'                   => 'boolean',
            'ingredients'                 => 'nullable|array',
            'ingredients.*.ingredient_id' => 'required|exists:ingredients,id',
            'ingredients.*.is_default'    => 'boolean',
            'variant_group_ids'           => 'nullable|array',
            'variant_group_ids.*'         => 'exists:dish_variant_groups,id',
        ];
    }
}
