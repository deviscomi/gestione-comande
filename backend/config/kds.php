<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Token dei display KDS
    |--------------------------------------------------------------------------
    | I display KDS (cucina/pizzeria/bar) sono postazioni non interattive senza
    | login. Si autenticano con un token condiviso, passato come header
    | "X-KDS-Token" oppure come query string "?kds_token=...".
    |
    | Se vuoto (default in sviluppo), l'accesso è concesso solo alle reti
    | fidate elencate in "trusted_networks". In produzione impostare un token
    | forte (KDS_DISPLAY_TOKEN) — vedi backend/.env.production.example.
    */
    'display_token' => env('KDS_DISPLAY_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | Reti fidate (LAN)
    |--------------------------------------------------------------------------
    | Elenco di IP/CIDR autorizzati ad accedere agli endpoint KDS anche senza
    | token. Default: loopback + range privati RFC1918 (deploy su LAN).
    | nginx inoltra il REMOTE_ADDR reale del client, quindi il match avviene
    | sull'IP effettivo del display. Restringere agli IP dei soli display dove
    | possibile. Impostare a stringa vuota per disabilitare l'accesso by-LAN e
    | richiedere sempre il token.
    */
    'trusted_networks' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env(
            'KDS_TRUSTED_NETWORKS',
            '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'
        ))
    ))),

];
