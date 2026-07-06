<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Autenticazione dell'agente di stampa (Raspberry Pi) in modalità
 * PRINT_DRIVER=agent. L'agente è una macchina, non un utente: si autentica con
 * un token condiviso (config printing.agent_token), passato come
 * "Authorization: Bearer <token>" oppure header "X-Agent-Token".
 *
 * Ogni istanza (un ristorante = uno stack Docker) ha il suo token.
 */
class EnsurePrintAgent
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('printing.driver') !== 'agent') {
            return response()->json([
                'message'    => "Modalità agente di stampa non attiva",
                'error_code' => 'agent_disabled',
            ], 503);
        }

        $configured = config('printing.agent_token');
        if (empty($configured)) {
            return response()->json([
                'message'    => 'Token agente di stampa non configurato sul server',
                'error_code' => 'agent_token_missing',
            ], 503);
        }

        $provided = $request->bearerToken() ?? $request->header('X-Agent-Token');
        if (! is_string($provided) || ! hash_equals((string) $configured, $provided)) {
            return response()->json([
                'message'    => 'Agente di stampa non autorizzato',
                'error_code' => 'agent_unauthorized',
            ], 403);
        }

        return $next($request);
    }
}
