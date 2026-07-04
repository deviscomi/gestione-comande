# Contesto Sessione — Sistema Gestione Comande

## Stato attuale del progetto
Il progetto è in fase di debug attivo. La sessione precedente è stata interrotta.
Il compito attuale è identificare e correggere tutti gli errori presenti nell'applicazione.

## Infrastruttura
- **Server:** Ubuntu Server 24.04 LTS con Docker + Docker Compose
- **Avvio:** `docker compose up -d` dalla root del progetto
- **Database:** MariaDB in container Docker
- **Frontend:** React PWA (porta 3000)
- **Backend:** Laravel 11 API (porta 8000)
- **WebSocket:** Laravel Reverb (porta 8080)
- **Queue:** Laravel Queue Worker (stampa ESC/POS)

## Documentazione disponibile — LEGGI PRIMA DI TUTTO
Tutti i requisiti e le specifiche tecniche sono nei file seguenti:

| File | Contenuto |
|---|---|
| `docs/DRF.md` | Requisiti funzionali completi (6 blocchi) |
| `docs/SCHEMA_DB.md` | Schema database — 21 tabelle con campi e relazioni |
| `docs/API_REST.md` | 57 endpoint REST + 5 canali WebSocket |
| `docs/agents/AGENT_01_setup.md` | Setup infrastruttura |
| `docs/agents/AGENT_02_database.md` | Migrazioni e modelli |
| `docs/agents/AGENT_03_api_menu.md` | API menu cucina e pizzeria |
| `docs/agents/AGENT_04_api_ordini.md` | API zone, tavoli, ordini |
| `docs/agents/AGENT_05_print.md` | PrintDispatcher e sistema stampa ESC/POS |
| `docs/agents/AGENT_06_backoffice.md` | API backoffice, report, chiusura giornaliera |
| `docs/agents/AGENT_07_frontend_tablet.md` | Interfaccia cameriere PWA |
| `docs/agents/AGENT_08_frontend_admin.md` | Backoffice admin |

## Regole di sviluppo — rispettare sempre

### Backend (Laravel)
- Tutti i prezzi: `DECIMAL(8,2)` nel DB
- I prezzi vengono cristallizzati al momento dell'ordine (snapshot)
- API prefix: `/api/v1`
- Middleware `auth:sanctum` su tutti gli endpoint tranne `POST /auth/login`
- Middleware `role:admin` su endpoint admin-only (403 se cameriere)
- Ogni operazione rilevante va loggata tramite `LogsActivity` trait
- Ordini con `status = locked` sono in sola lettura
- Lo stato `in_corso` del tavolo viene impostato SOLO dal sistema (mai dal cameriere)
- I PDF di backup stampa vengono eliminati alla chiusura del tavolo

### Frontend (React)
- Usare CSS variables (`var(--color-*)`) per tutti i colori
- PIN default: `1234` (caricato da `/api/v1/settings/tablet_pin`)
- Timeout inattività: 300 secondi
- Offline queue: se fetch fallisce, salvare in IndexedDB e ritentare al reconnect
- WebSocket Echo: connessione automatica al boot, reconnect automatico

## Approccio al debug richiesto

1. **Prima di modificare qualsiasi file:** leggi il documento `docs/` pertinente
2. **Per ogni errore:** identifica la causa, spiega cosa manca o è sbagliato, poi correggi
3. **Non inventare logiche non specificate:** attieniti a quanto descritto nei docs
4. **Dopo ogni correzione:** verifica che non rompa altri componenti
5. **Priorità di correzione:**
   - Errori bloccanti (app non parte)
   - Errori di autenticazione e routing
   - Errori API (endpoint non funzionanti)
   - Errori frontend (UI non si carica o non funziona)
   - Errori stampa (PrintDispatcher)

## Comandi utili nel container Docker

```bash
# Entra nel container backend
docker compose exec app bash

# Vedi i log in tempo reale
docker compose logs -f app
docker compose logs -f queue
docker compose logs -f reverb

# Riesegui migrazioni
docker compose exec app php artisan migrate

# Svuota cache
docker compose exec app php artisan config:clear
docker compose exec app php artisan cache:clear
docker compose exec app php artisan route:clear

# Vedi le route registrate
docker compose exec app php artisan route:list

# Stato container
docker compose ps
```

## Come segnalare un errore
Quando trovi un errore, descrivilo così:
- File e riga dove si trova
- Messaggio di errore esatto
- Comportamento atteso vs comportamento reale