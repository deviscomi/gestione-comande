<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Driver di stampa
    |--------------------------------------------------------------------------
    | 'socket' — il server apre un socket TCP diretto verso la stampante
    |            (porta 9100). Funziona solo se server e stampante sono sulla
    |            stessa LAN: è la modalità per lo sviluppo/deploy in locale.
    |
    | 'agent'  — il server NON contatta la stampante. Mette i job in coda
    |            (tabella print_jobs) e un agente locale (Raspberry Pi) dentro
    |            la LAN del ristorante li preleva via REST, li stampa e conferma
    |            l'esito. È la modalità per l'hosting su server remoto: da lì
    |            l'IP privato della stampante non è raggiungibile.
    */
    'driver' => env('PRINT_DRIVER', 'socket'),

    /*
    |--------------------------------------------------------------------------
    | Token dell'agente di stampa (modalità 'agent')
    |--------------------------------------------------------------------------
    | Segreto condiviso con il Raspberry: viene passato come
    | "Authorization: Bearer <token>" (o header "X-Agent-Token") sulle rotte
    | /api/v1/agent/*. Ogni istanza (un ristorante = uno stack Docker) ha il
    | suo token. Se vuoto in modalità 'agent', le rotte agente rispondono 503.
    */
    'agent_token' => env('PRINT_AGENT_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | Lease di presa in carico (secondi)
    |--------------------------------------------------------------------------
    | Quando l'agente preleva un job, questo passa a 'printing' con claimed_at.
    | Se non arriva la conferma entro questo tempo (agente/Pi crashato dopo il
    | fetch), il job torna prelevabile al polling successivo. Consegna
    | at-least-once: un raro ACK perso può causare una ristampa.
    */
    'agent_lease_seconds' => (int) env('PRINT_AGENT_LEASE_SECONDS', 90),

    /*
    |--------------------------------------------------------------------------
    | Dimensione massima del batch per fetch
    |--------------------------------------------------------------------------
    | Quanti job restituire al massimo a ogni GET /agent/print-jobs.
    */
    'agent_batch' => (int) env('PRINT_AGENT_BATCH', 10),

    /*
    |--------------------------------------------------------------------------
    | Tentativi massimi prima del fallback PDF
    |--------------------------------------------------------------------------
    | Allineato a ProcessPrintJob::$tries (modalità socket). In modalità agent
    | è il numero di consegne fallite dopo cui si genera il PDF di backup e il
    | job passa a 'failed'.
    */
    'max_attempts' => (int) env('PRINT_MAX_ATTEMPTS', 5),

    /*
    |--------------------------------------------------------------------------
    | TTL dell'heartbeat dell'agente (secondi)
    |--------------------------------------------------------------------------
    | L'agente invia un heartbeat periodico (POST /agent/heartbeat) con stato e
    | raggiungibilità delle stampanti. Lo stato viene tenuto in cache per questo
    | tempo: se scade senza nuovi heartbeat, il backoffice considera il Pi
    | offline. Va impostato a qualche volta l'intervallo di heartbeat dell'agente
    | (default agente 30s ⇒ 90s tollera un beat perso).
    */
    'agent_heartbeat_ttl' => (int) env('PRINT_AGENT_HEARTBEAT_TTL', 90),

];
