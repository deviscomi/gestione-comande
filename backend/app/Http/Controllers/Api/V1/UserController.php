<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    use LogsActivity;

    public function index(Request $request): AnonymousResourceCollection
    {
        $q = User::query();
        if ($request->has('role'))   $q->where('role', $request->role);
        if ($request->has('status')) $q->where('status', $request->status);
        return UserResource::collection($q->orderBy('name')->get());
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = User::create([
            'name'          => $request->name,
            'surname'       => $request->surname,
            'username'      => $request->username,
            'password_hash' => Hash::make($request->password),
            'role'          => $request->role,
            'pin'           => $request->pin,
            'status'        => 'active',
        ]);
        $this->logActivity('USER_CREATED', "Utente '{$user->username}' ({$user->role}) creato", $user);
        return response()->json(new UserResource($user), 201);
    }

    public function update(UpdateUserRequest $request, User $user): UserResource|JsonResponse
    {
        $actor = auth()->user();

        // Il super_admin non può essere rinominato da nessuno
        if ($user->role === 'super_admin') {
            $forbidden = array_intersect(array_keys($request->all()), ['name', 'surname', 'username']);
            if (!empty($forbidden)) {
                return response()->json(['message' => 'Il super admin non può essere rinominato'], 422);
            }
        }

        // Un admin normale non può modificare un altro admin (né il super_admin)
        if ($actor->role === 'admin' && in_array($user->role, ['admin', 'super_admin']) && $user->id !== $actor->id) {
            return response()->json(['message' => 'Non puoi modificare un altro admin'], 403);
        }

        $data = $request->safe()->except(['password']);
        if ($request->filled('password')) {
            $data['password_hash'] = Hash::make($request->password);
        }
        $user->update($data);
        $this->logActivity('USER_UPDATED', "Utente '{$user->username}' aggiornato", $user);
        return new UserResource($user->fresh());
    }

    public function destroy(User $user): JsonResponse
    {
        $actor = auth()->user();

        // Nessuno può eliminare il super_admin
        if ($user->role === 'super_admin') {
            return response()->json(['message' => 'Il super admin non può essere eliminato'], 422);
        }

        // Nessuno può eliminare se stesso
        if ($user->id === $actor->id) {
            return response()->json(['message' => 'Non puoi eliminare il tuo account'], 422);
        }

        // Un admin normale non può eliminare un altro admin (solo il super_admin può)
        if ($actor->role === 'admin' && $user->role === 'admin') {
            return response()->json(['message' => 'Non puoi eliminare un altro admin'], 403);
        }

        if ($user->orders()->where('status', 'open')->exists()) {
            return response()->json(['message' => 'Utente con ordini aperti'], 422);
        }

        try {
            $this->logActivity('USER_DELETED', "Utente '{$user->username}' eliminato", $user);
            $user->delete();
        } catch (\Illuminate\Database\QueryException $e) {
            return response()->json(['message' => 'Impossibile eliminare l\'utente: esistono ancora dati collegati'], 422);
        }

        return response()->json(null, 204);
    }

    public function toggle(User $user): JsonResponse
    {
        // Solo camerieri e cassieri possono essere disattivati
        if (!in_array($user->role, ['waiter', 'cashier'])) {
            return response()->json(['message' => 'Solo camerieri e cassieri possono essere disattivati'], 422);
        }
        $user->update(['status' => $user->status === 'active' ? 'inactive' : 'active']);
        $this->logActivity('USER_TOGGLED',
            "Utente '{$user->username}' " . ($user->status === 'active' ? 'attivato' : 'disattivato'),
            $user
        );
        return response()->json(new UserResource($user));
    }

    public function updatePin(Request $request, User $user): UserResource|JsonResponse
    {
        $actor = auth()->user();

        // Un admin normale non può cambiare il PIN di un altro admin (né del super_admin)
        if ($actor->role === 'admin' && in_array($user->role, ['admin', 'super_admin']) && $user->id !== $actor->id) {
            return response()->json(['message' => 'Non puoi cambiare il PIN di un altro admin'], 403);
        }

        $request->validate(['pin' => 'required|string|digits_between:4,6']);
        $user->update(['pin' => $request->pin]);
        $this->logActivity('PIN_CHANGED', "PIN cambiato per '{$user->username}'", $user);
        return new UserResource($user);
    }
}
