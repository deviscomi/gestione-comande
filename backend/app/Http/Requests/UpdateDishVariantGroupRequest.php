<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDishVariantGroupRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                 => 'sometimes|string|max:100',
            'department'           => 'sometimes|in:cucina,bar,pizzeria,vini',
            'is_required'          => 'sometimes|boolean',
            'is_active'            => 'sometimes|boolean',
            'sort_order'           => 'sometimes|integer',
            'options'              => 'nullable|array',
            'options.*.id'         => 'nullable|exists:dish_variant_options,id',
            'options.*.name'       => 'required|string|max:100',
            'options.*.price_add'  => 'required|numeric|min:0',
        ];
    }
}
