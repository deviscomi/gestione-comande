<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWineRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'         => 'sometimes|string|max:150',
            'producer'     => 'nullable|string|max:150',
            'vintage_year' => 'nullable|integer',
            'price'        => 'sometimes|numeric|min:0',
            'description'  => 'nullable|string',
            'is_active'    => 'sometimes|boolean',
            'category_id'  => [
                'sometimes',
                Rule::exists('categories', 'id')->where('department', 'carta_vini'),
            ],
            'variant_group_ids'   => 'nullable|array',
            'variant_group_ids.*' => 'exists:dish_variant_groups,id',
        ];
    }
}
