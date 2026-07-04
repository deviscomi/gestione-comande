#!/usr/bin/env bash
# ==========================================================================
#  Gestione Comande — installazione autonoma su server Debian
#  Uso:   sudo bash install.sh
#  Idempotente: puoi rieseguirlo senza rischi (aggiorna/riavvia lo stack).
# ==========================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Esegui come root:  sudo bash install.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> 1/5  Docker Engine + plugin compose"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "     Docker già presente: salto l'installazione."
fi

echo "==> 2/5  Abilito Docker all'avvio (ripartenza automatica dopo un reboot)"
systemctl enable --now docker

echo "==> 3/5  File di configurazione .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "     Creato .env da .env.example."
  echo "     >>> MODIFICA le password (CAMBIAMI) in .env prima dell'uso reale. <<<"
else
  echo "     .env già presente: lo lascio invariato."
fi

APP_PORT="$(grep -E '^APP_PORT=' .env | head -n1 | cut -d= -f2 | tr -d '[:space:]')"
APP_PORT="${APP_PORT:-80}"

echo "==> 4/5  Firewall (solo se ufw è attivo): porte 22 (SSH) e ${APP_PORT} (app)"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 22/tcp || true
  ufw allow "${APP_PORT}/tcp" || true
else
  echo "     ufw non attivo: nessuna regola aggiunta."
fi

echo "==> 5/5  Build e avvio dello stack (il primo avvio scarica le immagini e compila: può richiedere qualche minuto)"
docker compose up -d --build

echo
echo "======================================================================"
echo " Completato. Stato dei servizi:"
docker compose ps
echo
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo " App:   http://${IP:-IP-DEL-SERVER}:${APP_PORT}"
echo " Login: admin / admin123   (cambia la password dopo il primo accesso)"
echo "======================================================================"
