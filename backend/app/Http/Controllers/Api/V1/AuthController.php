<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\ForceLogout;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use LogsActivity;

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)
            ->where('status', 'active')
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password_hash)) {
            throw ValidationException::withMessages([
                'username' => ['Credenziali non valide.'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        $this->logActivity('login', "Login utente: {$user->username}");

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'             => $user->id,
                'name'           => $user->name,
                'username'       => $user->username,
                'role'           => $user->role,
                'is_super_admin' => $user->role === 'super_admin',
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->logActivity('logout', "Logout utente: {$request->user()->username}");
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id'             => $user->id,
            'name'           => $user->name,
            'username'       => $user->username,
            'role'           => $user->role,
            'is_super_admin' => $user->role === 'super_admin',
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->currentAccessToken()->delete();
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json(['token' => $token]);
    }

    public function forceLogout(Request $request, User $user): JsonResponse
    {
        $user->tokens()->delete();
        broadcast(new ForceLogout($user->id))->toOthers();

        $this->logActivity('force_logout', "Force logout su utente: {$user->username}", $user);

        return response()->json(['message' => 'User logged out']);
    }
}
