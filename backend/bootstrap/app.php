<?php

use App\Http\Middleware\CheckKdsAccess;
use App\Http\Middleware\CheckModule;
use App\Http\Middleware\CheckRole;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        channels: __DIR__.'/../routes/channels.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role'     => CheckRole::class,
            'module'   => CheckModule::class,
            'kds.auth' => CheckKdsAccess::class,
        ]);

        // Il default del framework reindirizza gli ospiti a route('login')
        // (inesistente in questa SPA): per /api/* la Authenticate valuta quel
        // redirect in modo eager e solleva "Route [login] not defined" (500)
        // prima ancora di arrivare all'handler. Restituendo null per le API,
        // l'AuthenticationException arriva pulita all'handler ⇒ 401 JSON.
        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('api/*') ? null : '/login'
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Le richieste API non autenticate devono ricevere un 401 JSON, mai un
        // redirect alla rotta 'login' (inesistente ⇒ 500 "Route [login] not
        // defined"). Forzando il rendering JSON per /api/* la unauthenticated()
        // del framework risponde 401 JSON anche senza header Accept.
        // Copre anche /api/v1/broadcasting/auth senza token.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, $throwable) => $request->is('api/*') || $request->expectsJson()
        );

        // Uniforma il corpo del 401 aggiungendo error_code per il client.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message'    => $e->getMessage() ?: 'Unauthenticated.',
                    'error_code' => 'unauthenticated',
                ], 401);
            }
        });
    })->create();
