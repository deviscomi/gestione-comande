import api from '../api/axios'
import { getDb, STORE, getPendingCount } from '../api/offlineQueue'

export { queueRequest, getPendingCount } from '../api/offlineQueue'

// Tetto di tentativi per gli errori server transitori (5xx): evita di restare
// bloccati per sempre su una richiesta che il server rifiuta ripetutamente.
const MAX_ATTEMPTS = 5

// Ritorna true se almeno una richiesta accodata è stata inviata con successo,
// così il chiamante sa se invalidare le query in cache.
export async function flushQueue() {
  const db  = await getDb()
  const all = await db.getAll(STORE)
  let flushedAny = false
  const dropped = []

  for (const req of all) {
    try {
      await api({ method: req.method, url: req.url, data: req.data })
      await db.delete(STORE, req.id)
      flushedAny = true
    } catch (e) {
      // Backend irraggiungibile: transitorio (offline). Interrompe e riprova al
      // prossimo giro, senza consumare tentativi né scartare la richiesta.
      if (!e.response) break

      const status = e.response.status

      // Errori server / rate limit: transitori. Si riprova, ma con un tetto di
      // tentativi per non restare bloccati su un 5xx persistente (head-of-line).
      if (status >= 500 || status === 429 || status === 408) {
        const attempts = (req.attempts ?? 0) + 1
        if (attempts < MAX_ATTEMPTS) {
          await db.put(STORE, { ...req, attempts })
          break // preserva l'ordine: ritenta questo item al giro successivo
        }
        await db.delete(STORE, req.id)
        dropped.push({ method: req.method, url: req.url, status, reason: 'server' })
        continue
      }

      // Errori client (4xx): permanenti, la richiesta non andrà mai a buon fine.
      // Non scartare in silenzio: rimuovi e segnala all'utente che l'azione
      // salvata offline non è stata applicata.
      await db.delete(STORE, req.id)
      dropped.push({ method: req.method, url: req.url, status, reason: 'client' })
    }
  }

  if (dropped.length && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-queue-dropped', { detail: dropped }))
  }

  return flushedAny
}

// Flush al ripristino della connessione di rete (utile quando il dispositivo
// torna online dopo un vero distacco Wi-Fi).
if (typeof window !== 'undefined') {
  window.addEventListener('online', flushQueue)
}
