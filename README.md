# Gestione Comande — Ristorante / Pizzeria

PWA per la gestione comande su tablet (cameriere) + backoffice admin, con stampa
termica multi-reparto ESC/POS su LAN, KDS (Kitchen Display System) opzionale e
WebSocket real-time (Laravel Reverb).

Stack: **Laravel 11 / PHP 8.3** · **React 18 + Vite 5 (PWA)** · **MariaDB 11.4** ·
**Reverb (WebSocket)** · **Docker**.

Documentazione di dettaglio in [`docs/`](docs/) e [`CLAUDE.md`](CLAUDE.md).

---

## Sviluppo (Docker)

```bash
cp backend/.env.example backend/.env          # ambiente di sviluppo
docker compose up -d --build
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

App su <http://localhost:8000>. Il frontend va compilato con `npm run build`
(vedi `frontend/`); in questo progetto **non** si usa `npm run dev`.

---

## Piani commerciali (tier)

Due sole fasce, distinte unicamente dal modulo **KDS**:

| Tier   | Moduli attivi                                                                 | KDS |
|--------|-------------------------------------------------------------------------------|-----|
| `base` | core, printing, pizzeria, reports, daily_closure, advanced_backoffice, outdoor_tables, fiscal | ❌  |
| `pro`  | tutti quelli di *base* **+ kds**                                               | ✅  |

Un'installazione pulita parte in **Base** (KDS spento).

---

## Deploy in produzione

> ⚠️ Non riusare mai i segreti di sviluppo. Generare chiavi forti e uniche per
> ogni installazione (vedi commenti in `backend/.env.production.example`).

### 1. Configurazione ambiente

```bash
cp backend/.env.production.example backend/.env
# Valorizzare i placeholder: APP_KEY, DB_PASSWORD, REVERB_APP_KEY/SECRET,
# SANCTUM_STATEFUL_DOMAINS, APP_URL.
docker compose exec app php artisan key:generate
```

Punti chiave dell'hardening (già impostati nel template):
`APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=warning`,
`SESSION_SECURE_COOKIE=true` (su HTTPS), Reverb key/secret forti,
`SANCTUM_STATEFUL_DOMAINS` esplicito.

### 2. Migrazioni e cache di produzione

```bash
docker compose exec app php artisan migrate --force
docker compose exec app php artisan db:seed --force        # solo primo deploy

# Cache di configurazione, rotte e viste (obbligatorie in produzione):
docker compose exec app php artisan config:cache
docker compose exec app php artisan route:cache
docker compose exec app php artisan event:cache
docker compose exec app php artisan view:cache
```

> Dopo **ogni** modifica a `.env` o ai file di config in produzione rieseguire
> `php artisan config:cache` (e `route:cache` se cambiano le rotte). In fase di
> troubleshooting usare `php artisan config:clear` / `route:clear` per tornare a
> leggere i valori runtime.

### 3. Frontend

```bash
cd frontend && npm ci && npm run build
```

Il build (`frontend/dist/`) viene servito da nginx come definito in
`docker/nginx.conf`.
