<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Response;

/**
 * Autenticazione leggera per i display KDS non interattivi.
 *
 * I display cucina/pizzeria/bar non hanno login: si autenticano con un token
 * condiviso (header "X-KDS-Token" o query "?kds_token=") oppure — in mancanza
 * di token configurato — solo se la richiesta arriva da una rete fidata (LAN).
 *
 * Lo scope ('read' per la coda, 'write' per gli aggiornamenti di stato/chiamata)
 * tiene separati i permessi di lettura e scrittura: entrambi passano oggi dalla
 * stessa verifica, ma la separazione consente di irrigidire la sola scrittura
 * in futuro senza toccare la lettura.
 */
class CheckKdsAccess
{
    public function handle(Request $request, Closure $next, string $scope = 'read'): Response
    {
        if ($this->tokenMatches($request) || $this->fromTrustedNetwork($request)) {
            return $next($request);
        }

        return response()->json([
            'message'    => 'Accesso ai display KDS non autorizzato',
            'error_code' => 'kds_unauthorized',
            'scope'      => $scope,
        ], 401);
    }

    private function tokenMatches(Request $request): bool
    {
        $configured = config('kds.display_token');

        if (empty($configured)) {
            return false;
        }

        $provided = $request->header('X-KDS-Token') ?? $request->query('kds_token');

        return is_string($provided) && hash_equals((string) $configured, $provided);
    }

    private function fromTrustedNetwork(Request $request): bool
    {
        $networks = config('kds.trusted_networks', []);

        if (empty($networks)) {
            return false;
        }

        return IpUtils::checkIp($request->ip() ?? '', $networks);
    }
}
