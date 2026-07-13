# Agente di stampa (Raspberry Pi)

Piccolo servizio Node.js che gira **dentro la rete del ristorante** e fa da ponte
tra l'app (su server remoto) e le stampanti termiche in LAN.

Perché serve: quando l'app è su un server remoto, quel server **non può**
raggiungere l'IP privato `192.168.x.x` della stampante. L'agente, che sta sulla
stessa LAN delle stampanti, preleva i job di stampa via REST e inoltra i byte
ESC/POS alla stampante (TCP porta 9100). Vedi `docs/REMOTE_PRINTING.md`.

- **Zero dipendenze** (solo Node ≥18: moduli `net` e `fetch`).
- Un Raspberry per ristorante; gestisce tutte le stampanti del locale (cassa,
  cucina, bar, pizzeria): è il server a dirgli, per ogni job, a quale IP:porta
  inviare.
- Solo traffico **in uscita** HTTPS: nessuna porta da aprire sul router.

## Come funziona

Ogni ~2 secondi:

1. `GET /api/v1/agent/print-jobs` (header `Authorization: Bearer <AGENT_TOKEN>`)
   → riceve i job pronti con i byte ESC/POS (base64) e l'IP:porta stampante,
   più eventuali stampe di test.
2. Per ogni job apre un socket TCP verso la stampante e scrive i byte.
3. Conferma l'esito: `POST /api/v1/agent/print-jobs/{id}/ack {status: printed|failed}`.
   Se fallisce, il server ritenta e dopo N tentativi genera il PDF di backup e
   segnala l'errore nel backoffice.

Inoltre, ogni `HEARTBEAT_INTERVAL_MS` (default 30s):

4. `POST /api/v1/agent/heartbeat` con uptime, versione agente e raggiungibilità
   delle stampanti (testate dalla LAN). Il server risponde con l'inventario
   aggiornato delle stampanti attive, testato al giro successivo. Il backoffice
   (Stampanti) mostra così se il Pi è **online/offline** e se ogni stampante è
   raggiungibile — l'unico modo, in modalità agent, dato che il server non può
   raggiungere gli IP privati della LAN.

## Prerequisiti

- Lato **server**: l'istanza del ristorante deve avere `PRINT_DRIVER=agent` e un
  `PRINT_AGENT_TOKEN` impostato (genera con `openssl rand -hex 32`), ed essere
  raggiungibile su un **URL pubblico HTTPS**.
- Lato **Raspberry**: Node.js ≥18.

## Installazione sul Raspberry Pi

```bash
# 1) Node.js LTS (se non presente)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2) Copia questa cartella sul Pi
sudo mkdir -p /opt/print-agent
sudo cp -r index.js package.json .env.example print-agent.service /opt/print-agent/
cd /opt/print-agent

# 3) Configura
sudo cp .env.example .env
sudo nano .env         # imposta SERVER_URL e AGENT_TOKEN

# 4) Prova a mano (Ctrl+C per uscire)
node index.js

# 5) Installa come servizio (parte al boot, si riavvia da solo)
sudo cp print-agent.service /etc/systemd/system/print-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now print-agent

# 6) Log in tempo reale
journalctl -u print-agent -f
```

> Il file `.env` contiene il token: mantienilo leggibile solo a root/pi
> (`sudo chmod 600 /opt/print-agent/.env`).

## Configurazione (`.env`)

| Variabile | Descrizione | Default |
|---|---|---|
| `SERVER_URL` | URL HTTPS dell'istanza del ristorante (senza slash finale) | — (obbligatorio) |
| `AGENT_TOKEN` | Deve coincidere con `PRINT_AGENT_TOKEN` del server | — (obbligatorio) |
| `POLL_INTERVAL_MS` | Intervallo di polling | `2000` |
| `SOCKET_TIMEOUT_MS` | Timeout connessione alla stampante | `8000` |
| `HEARTBEAT_INTERVAL_MS` | Intervallo dell'heartbeat di stato | `30000` |
| `HTTP_TIMEOUT_MS` | Timeout per le chiamate HTTP verso il server | `10000` |

## Diagnostica

- `GET print-jobs HTTP 503` → sul server manca `PRINT_DRIVER=agent` o
  `PRINT_AGENT_TOKEN`.
- `HTTP 403` → `AGENT_TOKEN` diverso da quello del server.
- `server irraggiungibile` → controlla `SERVER_URL`/HTTPS/connettività.
- `job … FALLITO: timeout/ECONNREFUSED` → IP/porta stampante errati o stampante
  spenta (il server farà il fallback PDF dopo i tentativi).
- Test stampante: nel backoffice, Stampanti → "Test"; il ticket esce dal Pi.
