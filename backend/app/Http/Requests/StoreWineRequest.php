<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWineRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'         => 'required|string|max:150',
            'producer'     => 'nullable|string|max:150',
            'vintage_year' => 'nullable|integer',
            'price'        => 'required|numeric|min:0',
            'description'  => 'nullable|string',
            'is_active'    => 'boolean',
            'category_id'  => [
                'required',
                Rule::exists('categories', 'id')->where('department', 'carta_vini'),
            ],
            'variant_group_ids'   => 'nullable|array',
            'variant_group_ids.*' => 'exists:dish_variant_groups,id',
        ];
    }
}
