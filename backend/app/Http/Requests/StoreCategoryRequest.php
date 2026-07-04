<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCategoryRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'       => 'required|string|max:100',
            'department' => 'required|in:cucina,pizzeria,bevande,dessert,amari,vini_casa,carta_vini,bar',
            'sort_order' => 'integer|min:0',
            'is_active'  => 'boolean',
        ];
    }
}
