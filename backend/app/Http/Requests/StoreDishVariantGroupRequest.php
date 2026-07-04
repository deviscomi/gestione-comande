<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDishVariantGroupRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'                 => 'required|string|max:100',
            'department'           => 'required|in:cucina,bar,pizzeria,vini',
            'is_required'          => 'boolean',
            'is_active'            => 'boolean',
            'sort_order'           => 'integer',
            'options'              => 'nullable|array',
            'options.*.id'         => 'nullable|exists:dish_variant_options,id',
            'options.*.name'       => 'required|string|max:100',
            'options.*.price_add'  => 'required|numeric|min:0',
        ];
    }
}
