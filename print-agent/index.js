// Gestione Comande — Agente di stampa locale (Raspberry Pi)
//
// Gira dentro la LAN del ristorante. Fa polling REST verso la sua istanza,
// riceve i byte ESC/POS già renderizzati dal server e li inoltra alla stampante
// termica (TCP porta 9100). Il server non contatta mai la stampante: da un host
// remoto l'IP privato 192.168.x.x non è raggiungibile.
//
// Zero dipendenze: solo moduli built-in Node (>=18) — `net` e `fetch` globale.

import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Caricamento .env (senza dipendenze) ─────────────────────────────────────
// Utile quando si lancia "node index.js" a mano. Con systemd si usa invece
// EnvironmentFile (vedi print-agent.service): le variabili sono già in env e
// questo loader non le sovrascrive.
function loadEnv() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(dir, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv();

const BASE = (process.env.SERVER_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.AGENT_TOKEN || '';
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const SOCKET_TIMEOUT_MS = Number(process.env.SOCKET_TIMEOUT_MS || 8000);
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 30000);
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 10000);

if (!BASE || !TOKEN) {
  console.error('Configurazione mancante: SERVER_URL e AGENT_TOKEN sono obbligatori (vedi .env.example).');
  process.exit(1);
}

const ts = () => new Date().toISOString();
const startedAt = Date.now();

// Versione dell'agente (dal package.json), riportata negli heartbeat.
function readVersion() {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version || null;
  } catch (e) {
    return null;
  }
}
const VERSION = readVersion();

// ── HTTP verso l'istanza ────────────────────────────────────────────────────
// AbortSignal.timeout: senza un timeout esplicito, un fetch che resta appeso
// (bug di rete/TLS, non un errore pulito) blocca il ciclo per sempre invece
// di fallire e riprovare al giro successivo.
function api(pathname, options = {}) {
  return fetch(`${BASE}/api/v1/agent${pathname}`, {
    ...options,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
}

function ackJob(id, status, error) {
  return api(`/print-jobs/${id}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, error: error ? String(error).slice(0, 500) : undefined }),
  });
}

function ackTest(token) {
  return api(`/test-prints/${token}/ack`, { method: 'POST' });
}

// ── Invio byte alla stampante termica (TCP) ─────────────────────────────────
function sendToPrinter(host, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) });
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };

    socket.setTimeout(SOCKET_TIMEOUT_MS);
    socket.on('connect', () => {
      socket.write(buffer, (err) => (err ? finish(err) : socket.end()));
    });
    socket.on('close', () => finish());
    socket.on('error', (err) => finish(err));
    socket.on('timeout', () => finish(new Error('timeout connessione stampante')));
  });
}

// ── Ping stampante (solo connessione TCP, senza inviare dati) ───────────────
function pingPrinter(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port: Number(port) });
    let settled = false;
    const done = (reachable) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ reachable, latencyMs: reachable ? Date.now() - start : null });
    };
    socket.setTimeout(SOCKET_TIMEOUT_MS);
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
    socket.on('timeout', () => done(false));
  });
}

// ── Heartbeat ────────────────────────────────────────────────────────────────
// Handshake bidirezionale: l'agente segnala di essere vivo + la raggiungibilità
// delle stampanti ricevute all'ultimo giro; il server risponde con l'inventario
// aggiornato delle stampanti attive, che verrà testato al prossimo heartbeat.
// In modalità agent è l'unico modo per il backoffice di sapere se il Pi è online
// e se le stampanti sono raggiungibili dalla LAN.
let printerInventory = [];

async function heartbeatTick() {
  const printers = [];
  for (const p of printerInventory) {
    const r = await pingPrinter(p.ip_address, p.port);
    printers.push({ id: p.id, reachable: r.reachable, latency_ms: r.latencyMs });
  }

  let res;
  try {
    res = await api('/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
        agent_version: VERSION,
        printers,
      }),
    });
  } catch (e) {
    console.warn(`[${ts()}] heartbeat non inviato: ${e.message}`);
    return;
  }

  if (!res.ok) {
    console.warn(`[${ts()}] heartbeat HTTP ${res.status}`);
    return;
  }

  try {
    const body = await res.json();
    printerInventory = Array.isArray(body.printers) ? body.printers : [];
  } catch (e) {
    // risposta senza inventario: si mantiene quello precedente
  }
}

// ── Ciclo di polling ────────────────────────────────────────────────────────
async function tick() {
  let res;
  try {
    res = await api('/print-jobs');
  } catch (e) {
    console.warn(`[${ts()}] server irraggiungibile: ${e.message}`);
    return;
  }

  if (!res.ok) {
    // 503 = modalità agente non attiva / token mancante ; 403 = token errato.
    const body = await res.text().catch(() => '');
    console.warn(`[${ts()}] GET print-jobs HTTP ${res.status} ${body.slice(0, 160)}`);
    return;
  }

  const { jobs = [], tests = [] } = await res.json();

  for (const job of jobs) {
    const buf = Buffer.from(job.payload_b64, 'base64');
    try {
      await sendToPrinter(job.printer.ip_address, job.printer.port, buf);
      await ackJob(job.id, 'printed');
      console.log(`[${ts()}] job #${job.id} (${job.print_type}) → ${job.printer.name} [${job.printer.ip_address}:${job.printer.port}] OK`);
    } catch (e) {
      await ackJob(job.id, 'failed', e.message).catch(() => {});
      console.warn(`[${ts()}] job #${job.id} → ${job.printer.name} FALLITO: ${e.message}`);
    }
  }

  for (const t of tests) {
    const buf = Buffer.from(t.payload_b64, 'base64');
    try {
      await sendToPrinter(t.printer.ip_address, t.printer.port, buf);
      console.log(`[${ts()}] test → ${t.printer.name} OK`);
    } catch (e) {
      console.warn(`[${ts()}] test → ${t.printer.name} FALLITO: ${e.message}`);
    } finally {
      // Il test è "one-shot": si rimuove dalla coda a prescindere dall'esito
      // (l'operatore ri-clicca se serve).
      await ackTest(t.token).catch(() => {});
    }
  }
}

// Evita esecuzioni sovrapposte se un ciclo dura più dell'intervallo.
let running = false;
async function loop() {
  if (running) return;
  running = true;
  try {
    await tick();
  } catch (e) {
    console.error(`[${ts()}] errore ciclo: ${e.message}`);
  } finally {
    running = false;
  }
}

// Heartbeat con lo stesso guard anti-sovrapposizione del polling.
let hbRunning = false;
async function heartbeatLoop() {
  if (hbRunning) return;
  hbRunning = true;
  try {
    await heartbeatTick();
  } catch (e) {
    console.error(`[${ts()}] errore heartbeat: ${e.message}`);
  } finally {
    hbRunning = false;
  }
}

console.log(`[${ts()}] Print agent avviato → ${BASE} (polling ogni ${POLL_MS}ms, heartbeat ogni ${HEARTBEAT_MS}ms)`);
setInterval(loop, POLL_MS);
loop();
setInterval(heartbeatLoop, HEARTBEAT_MS);
heartbeatLoop();
