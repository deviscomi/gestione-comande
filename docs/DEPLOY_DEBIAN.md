# Deploy su server Debian (Docker)

Guida all'installazione autonoma del sistema Gestione Comande su un server Debian.
Obiettivo: **primo avvio funzionante**, **ripartenza automatica al reboot**, zero interventi tecnici a regime.

---

## 1. Prerequisiti
- Server **Debian 12 (bookworm)** o superiore, con accesso `root`/`sudo` e connessione a internet (serve al primo build).
- Il server e i tablet sulla **stessa LAN** (stessa rete della stampante termica).
- Porta **80** libera sul server (installazione Debian pulita → lo è).

## 2. Copiare il progetto sul server
Dal PC Windows, trasferisci l'intera cartella `gestione-comande` **escludendo** gli artefatti che verranno ricreati nel server (`node_modules`, `vendor`, `dist`).

Esempio con `rsync` (da WSL/Git-Bash) verso `/opt/gestione-comande`:
```bash
rsync -av --delete \
  --exclude 'node_modules' --exclude 'vendor' --exclude 'frontend/dist' \
  --exclude '.git' \
  ./gestione-comande/  utente@IP-SERVER:/opt/gestione-comande/
```
In alternativa: `scp -r` della cartella, oppure uno zip trasferito e scompattato in `/opt/gestione-comande`.

## 3. Installazione (un solo comando)
Sul server:
```bash
cd /opt/gestione-comande
sudo bash install.sh
```
Lo script: installa Docker + plugin compose, **lo abilita all'avvio del sistema**, crea `.env` da `.env.example`, apre il firewall (se `ufw` attivo), poi `docker compose up -d --build`.

> **Importante:** al primo run modifica le password in `.env` (vedi sotto) e rilancia `docker compose up -d`.

## 4. Configurazione — un unico file `.env`
Tutta la configurazione sta nel file **`.env`** nella cartella del progetto (creato da `install.sh`). Modifica almeno i valori `CAMBIAMI`:
```
APP_PORT=80
APP_URL=http://192.168.1.50      # IP LAN reale del server
DB_PASSWORD=...                  # password DB applicativo
DB_ROOT_PASSWORD=...             # password root DB
REVERB_APP_SECRET=...            # segreto WebSocket
```
Applica le modifiche con:
```bash
docker compose up -d
```
> `APP_KEY` è già valorizzata. Per rigenerarla: `docker compose run --rm app php artisan key:generate --show` e incolla il valore in `.env`.
> Se cambi `REVERB_APP_KEY`, aggiorna anche `frontend/.env.production` e ricostruisci il frontend (vedi §8).

## 5. Verifica
```bash
docker compose ps      # app/nginx/mariadb/reverb/queue/scheduler = Up; frontend-build = Exited (0)
curl -I http://localhost/     # → 200
```
Da un tablet sulla LAN: apri `http://IP-SERVER`, login **admin / admin123** (**cambia la password** dopo il primo accesso — utenti seed in `backend/database/seeders/UserSeeder.php`).
Real-time: in DevTools → Network → **WS**, deve esserci una connessione a `ws://IP-SERVER/app/comande-key` con stato **101**.

## 6. Ripartenza automatica al reboot
È garantita da due elementi già configurati:
1. **`systemctl enable docker`** (fatto da `install.sh`) → il daemon Docker parte al boot del server.
2. **`restart: unless-stopped`** su tutti i servizi in `docker-compose.yml` → Docker li riavvia da solo.

Test:
```bash
sudo reboot
# a boot completato, SENZA toccare nulla:
docker compose ps      # tutto Up
```
I dati persistono: DB nel volume `mariadb_data`, storage/PDF in `./backend/storage`. Le migrazioni sono idempotenti e il seed **non** viene rieseguito (utenti già presenti).

> `unless-stopped` rispetta uno stop volontario (`docker compose stop`). Se vuoi che riparta **sempre** anche dopo uno stop manuale, sostituisci con `restart: always` nel compose.

## 7. Stampante termica
La stampante NON si configura qui: si imposta da **Admin → Stampanti** indicando l'IP LAN della POS-8370 (ESC/POS, porta 9100). I container raggiungono la stampante sulla LAN tramite la rete del server (NAT bridge), nessuna configurazione di rete Docker aggiuntiva.

## 8. Operazioni comuni
| Operazione | Comando |
|---|---|
| Vedere i log | `docker compose logs -f app` (o `nginx`, `reverb`, `queue`...) |
| Riavviare tutto | `docker compose restart` |
| Aggiornare il **frontend** dopo modifiche | `docker compose up -d --build frontend-build` |
| Aggiornare il **backend** (nuovo codice) | `docker compose up -d --build app` |
| Ricostruire la cache Laravel | `docker compose restart app reverb queue scheduler` |
| **Reset demo** (azzera il DB) | `docker compose down -v && docker compose up -d` |
| Fermare (senza reboot) | `docker compose stop` |

**Backup del database:**
```bash
docker compose exec mariadb sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" gestione_comande' > backup_$(date +%F).sql
```
(pianificabile con un cron sull'host per backup automatici).

## 9. Limite noto: HTTPS / PWA installabile
L'app è servita in **HTTP** su `http://IP`. In HTTP il browser **non registra il service worker**: niente installazione PWA "a schermo intero" né cache offline via SW. L'app funziona comunque come web app normale e **la coda offline delle scritture (IndexedDB) resta attiva** (non richiede HTTPS) — è la parte critica in sala.
Per la PWA completa servirebbe HTTPS (certificato self-signed o CA locale da installare su ogni tablet), operazione per-dispositivo in contrasto con l'obiettivo di autonomia. In alternativa, sui tablet si usa la **modalità kiosk/schermo intero** del browser. L'HTTPS si può aggiungere in un secondo momento (es. reverse proxy con certificato).

## 10. Troubleshooting
- **`docker compose ps` mostra `frontend-build` non `Exited (0)`** → build frontend fallita: `docker compose logs frontend-build` (spesso rete/npm). Rilancia `docker compose up -d --build frontend-build`.
- **Un tablet non riceve aggiornamenti live** → verifica la connessione **WS 101** in DevTools; assicurati che la porta `APP_PORT` sia aperta nel firewall e che i tablet aprano l'IP del server (non `localhost`).
- **502 da nginx** → il container `app` non è pronto: `docker compose logs app` (di norma attende MariaDB e si risolve da solo).
- **Cambiato `.env` ma non ha effetto** → `docker compose up -d` (ricarica le variabili e ricostruisce la cache all'avvio).
