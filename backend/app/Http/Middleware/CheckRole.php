<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$allowedRoles): mixed
    {
        $userRole = $request->user()?->role;

        // super_admin ha accesso ovunque sia richiesto 'admin'
        if (in_array('admin', $allowedRoles) && $userRole === 'super_admin') {
            return $next($request);
        }

        if (!in_array($userRole, $allowedRoles, true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
