# Stampa in hosting remoto — Agente locale (Raspberry Pi)

## Il problema

In locale la stampa è **server → stampante**: il worker della coda apre un
socket TCP diretto verso `printer.ip_address:9100`. Funziona perché server e
stampante sono sulla stessa LAN.

Su **server remoto** (ogni ristorante = uno stack Docker, orchestrato con
Portainer) il server **non può** raggiungere l'IP privato `192.168.x.x` della
stampante: è dentro la rete del ristorante, non instradabile da Internet.

## La soluzione: driver di stampa `agent`

Un **agente locale** (Raspberry Pi) dentro la LAN del ristorante fa da ponte.
Si sceglie con la variabile `PRINT_DRIVER`:

| `PRINT_DRIVER` | Comportamento | Quando |
|---|---|---|
| `socket` (default) | il server apre il socket verso la stampante | sviluppo / deploy in LAN |
| `agent` | il server accoda i job; il Raspberry li preleva e stampa | server remoto |

In modalità `agent` **il server continua a generare i byte ESC/POS** (stesso
`EscPosRenderer`): il Pi è un semplice relè. Cambiare i template di stampa non
richiede aggiornare il Pi.

## Flusso (polling)

```
Ordine → PrintDispatcher crea PrintJob(pending)   [NON apre socket]
  Pi  → GET  /api/v1/agent/print-jobs   (Bearer PRINT_AGENT_TOKEN)
        ← { jobs: [{ id, print_type, printer:{ip,port,name}, payload_b64 }], tests: [...] }
             (server: job → 'printing', claimed_at=now, attempts++)
  Pi  → apre TCP verso printer.ip:port e scrive i byte
  Pi  → POST /api/v1/agent/print-jobs/{id}/ack { status: printed | failed }
server→ printed: 'done' + evento backoffice (+ pagamento 'printed' per lo scontrino)
        failed : attempts>=max ? (PDF backup + 'failed' + evento) : ('pending', riprovabile)
```

Il backoffice mostra stato stampe e fallback PDF **senza modifiche** (stesso
evento `PrintJobStatusChanged`). La stampa di **test** (Stampanti → Test) in
modalità `agent` viene accodata e stampata dal Pi.

## Sicurezza / rete

- L'agente si autentica con `PRINT_AGENT_TOKEN` (header `Authorization: Bearer`
  o `X-Agent-Token`). **Un token diverso per ogni ristorante/istanza.**
- Il Pi fa solo traffico **in uscita** HTTPS: nessuna porta da aprire sul router
  del ristorante.
- Le rotte `/api/v1/agent/*` sono fuori da `auth:sanctum` (è una macchina, non un
  utente) e gated dal modulo `printing`.

## Configurazione server (per ogni istanza)

Nel `.env` dell'istanza:

```dotenv
PRINT_DRIVER=agent
PRINT_AGENT_TOKEN=<openssl rand -hex 32>      # univoco per ristorante
# opzionali:
# PRINT_AGENT_LEASE_SECONDS=90                 # lease presa in carico
# PRINT_AGENT_BATCH=10                         # max job per fetch
# PRINT_MAX_ATTEMPTS=5                         # tentativi prima del PDF
```

Ogni stack Docker deve essere esposto su un **URL pubblico HTTPS** (reverse proxy
+ TLS davanti a Portainer, es. Traefik o Nginx Proxy Manager). Il Raspberry
punterà a quell'URL.

## Configurazione Raspberry

Vedi [`print-agent/README.md`](../print-agent/README.md): installazione Node,
`.env` (`SERVER_URL` + `AGENT_TOKEN`), servizio `systemd`.

## Le stampanti restano configurate nell'app

Il ristoratore continua a inserire nome/IP/porta di ogni stampante nel backoffice
come oggi. Cambia solo *chi* apre il socket: in modalità `agent` è il Pi, guidato
per ogni job dai dati che il server gli passa. Il Pi non va configurato per
singola stampante.

## Riferimenti nel codice

- `config/printing.php` — driver, token, lease, batch, tentativi.
- `app/Services/PrintDispatcher.php` — in `agent` non dispatcha il worker socket.
- `app/Jobs/ProcessPrintJob.php` — percorso `socket` (invariato nella sostanza).
- `app/Http/Controllers/Api/V1/PrintAgentController.php` — API dell'agente.
- `app/Http/Middleware/EnsurePrintAgent.php` — auth token agente.
- `app/Services/PrintCompletionService.php` — transizioni finali condivise
  (stampato / fallito+PDF), usate sia dal worker socket sia dall'ack agente.
