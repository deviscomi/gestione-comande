## Obiettivo

Abilita la **stampa remota** (app in hosting su server remoto ↔ stampanti termiche nella LAN del ristorante) tramite un agente locale su Raspberry Pi, e raccoglie l'hardening pre-lancio su moduli, licenza, KDS e robustezza offline.

## Contenuti principali

### Stampa remota (agente Raspberry Pi)
- Nuovo driver `PRINT_DRIVER=agent`: il server accoda i job e rende i byte ESC/POS; il Pi li preleva via REST e li inoltra alla stampante (TCP :9100). Da server remoto l'IP privato della stampante non è raggiungibile.
- API agente: `GET /api/v1/agent/print-jobs`, `POST /api/v1/agent/print-jobs/{id}/ack`, test-print; auth `Bearer PRINT_AGENT_TOKEN`. Lease di presa in carico, retry e fallback PDF.
- Reference agent Node (zero dipendenze, systemd) in `print-agent/`.
- **Monitoraggio heartbeat**: l'agente segnala online/offline + raggiungibilità stampanti dalla LAN (`POST /api/v1/agent/heartbeat`, handshake bidirezionale); il backoffice (Stampanti) mostra lo stato del Pi e di ogni stampante (`GET /api/v1/agent-status`).

### KDS
- KDS diventa un modulo vero (discriminante Base/Pro), autenticazione degli endpoint display, pagina di aiuto KDS nel backoffice (con QR).

### Moduli / licenza
- Check moduli unificato su `LicenseService::isActive`; mapping tier→moduli + provisioning; banner scadenza non bloccante; gating rotte lato frontend + ErrorBoundary + handler 403.

### Robustezza / API / deploy
- Coda offline che non scarta le richieste in silenzio; avviso bloccante su stampe fallite alla chiusura tavolo; 401 JSON pulito su `/api/*` (niente 500 "Route [login]"); prompt di aggiornamento PWA; template `.env.production` hardened + procedura di deploy.

### Menu pizzeria
- Portate/categorie per il menu pizzeria.

## Migrazioni DB
Il branch introduce nuove migrazioni (es. `claimed_at` su `print_jobs`, `category_id` su `pizzas`): eseguire `php artisan migrate` in deploy.

## Configurazione per andare in produzione (per istanza)
- Backend `.env`: `PRINT_DRIVER=agent`, `PRINT_AGENT_TOKEN=<openssl rand -hex 32>` (opz. `PRINT_AGENT_HEARTBEAT_TTL=90`), poi `php artisan config:cache`.
- Raspberry: `print-agent/.env` con `SERVER_URL`, `AGENT_TOKEN`, `HEARTBEAT_INTERVAL_MS`; `systemctl enable --now print-agent`.

## Test
- Feature test aggiunto: `backend/tests/Feature/PrintAgentHeartbeatTest.php` (eseguire con `php artisan test --filter=PrintAgentHeartbeat` dove il backend ha `vendor/` e il DB `gestione_comande_test`).
- Heartbeat dell'agente verificato end-to-end; build frontend verde.
