<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'surname'        => $this->surname,
            'username'       => $this->username,
            'role'           => $this->role,
            'is_super_admin' => $this->role === 'super_admin',
            'status'         => $this->status,
            'pin'            => $this->when(
                in_array($request->user()?->role, ['admin', 'super_admin']),
                $this->pin
            ),
        ];
    }
}
