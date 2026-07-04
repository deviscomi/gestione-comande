# Sistema di Gestione Comande — Ristorante Pizzeria

## Contesto progetto
PWA per gestione comande su tablet (cameriere) + backoffice admin (desktop/tablet).
Il sistema gestisce tavoli, ordini, varianti piatti/pizze e stampa termica multi-reparto su rete LAN.

## Stack tecnologico
| Layer | Tecnologia |
|---|---|
| Backend | Laravel 11, PHP 8.3+ |
| Auth | Laravel Sanctum (Bearer Token) |
| WebSocket | Laravel Reverb |
| Queue | Laravel Queue (database driver) |
| Database | MariaDB 11.4+ |
| Frontend | React 18 + Vite 5 |
| PWA | vite-plugin-pwa |
| State | Zustand 4 |
| Data fetching | TanStack Query 5 |
| CSS | Tailwind CSS 3 |
| Stampa | ESC/POS via TCP/IP porta 9100 |
| Stampante | Bisofice POS-8370 su LAN |

## Struttura monorepo
```
gestione-comande/
├── CLAUDE.md
├── docs/
│   ├── DRF.md
│   ├── SCHEMA_DB.md
│   ├── API_REST.md
│   └── agents/
├── backend/       (Laravel 11)
└── frontend/      (React + Vite PWA)
```

## Regole di sviluppo — SEMPRE rispettare

### Backend
- Tutti i prezzi: `DECIMAL(8,2)` nel DB
- I prezzi vengono **cristallizzati al momento dell'ordine** — snapshot, non dipendenti dal menu corrente
- API prefix: `/api/v1`
- Middleware `auth:sanctum` su tutti gli endpoint tranne `POST /auth/login`
- Middleware `role:admin` su endpoint admin-only (403 se cameriere tenta accesso)
- Ogni operazione rilevante va loggata tramite `ActivityLogger` trait
- Ordini con `status = locked` sono in sola lettura — nessuna modifica permessa
- Lo stato `in_corso` di un tavolo viene impostato SOLO dal sistema (mai dal cameriere direttamente)
- I PDF di backup stampa vengono eliminati alla chiusura del tavolo

### Frontend
- Usare CSS variables (`var(--color-*)`) per tutti i colori — dark mode automatica
- PIN di sblocco default: `1234` (caricato da `/api/v1/settings/tablet_pin`)
- Timeout inattività default: 300 secondi (caricato da `/api/v1/settings/inactivity_timeout`)
- Offline queue: se fetch fallisce per connessione, salvare in IndexedDB e ritentare al reconnect
- WebSocket Echo: connessione automatica al boot, reconnect automatico

## Documentazione completa
- Requisiti funzionali: `docs/DRF.md`
- Schema database: `docs/SCHEMA_DB.md`
- Mappa API REST: `docs/API_REST.md`
- Prompt agenti: `docs/agents/AGENT_0X_*.md`

## Ordine di esecuzione agenti
```
AGENT_01 → AGENT_02 → AGENT_03 + AGENT_04 (parallelo)
         → AGENT_05 + AGENT_06 (parallelo)
         → AGENT_07 + AGENT_08 (parallelo)
```
