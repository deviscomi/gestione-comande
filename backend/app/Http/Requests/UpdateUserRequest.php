<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'     => 'sometimes|string|max:100',
            'surname'  => 'sometimes|string|max:100',
            'username' => 'sometimes|string|max:50|unique:users,username,' . $this->route('user')->id,
            'password' => 'sometimes|string|min:6',
            'pin'      => 'sometimes|string|digits_between:4,6',
            'role'     => 'sometimes|in:admin,waiter,cashier',
        ];
    }
}
