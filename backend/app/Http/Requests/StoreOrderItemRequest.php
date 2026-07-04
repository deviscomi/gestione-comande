<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderItemRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'item_type'                    => 'required|in:dish,pizza,wine',
            'dish_id'                      => 'required_if:item_type,dish|exists:dishes,id',
            'pizza_id'                     => 'required_if:item_type,pizza|exists:pizzas,id',
            'wine_id'                      => 'required_if:item_type,wine|exists:wines,id',
            'quantity'                     => 'required|integer|min:1',
            'notes'                        => 'nullable|string|max:500',
            'modifications'                => 'nullable|array',
            'modifications.*.mod_type'     => 'required|string|max:50',
            'modifications.*.mod_value'    => 'required|string|max:200',
            'modifications.*.price_change' => 'required|numeric',
            'uscita'                        => 'sometimes|integer|min:1|max:9',
        ];
    }
}
