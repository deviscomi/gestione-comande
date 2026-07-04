import api from '../api/axios'
import { getDb, STORE, getPendingCount } from '../api/offlineQueue'

export { queueRequest, getPendingCount } from '../api/offlineQueue'

// Ritorna true se almeno una richiesta accodata è stata inviata con successo,
// così il chiamante sa se invalidare le query in cache.
export async function flushQueue() {
  const db  = await getDb()
  const all = await db.getAll(STORE)
  let flushedAny = false

  for (const req of all) {
    try {
      await api({ method: req.method, url: req.url, data: req.data })
      await db.delete(STORE, req.id)
      flushedAny = true
    } catch (e) {
      if (!e.response) break // backend ancora irraggiungibile: interrompe e riprova al prossimo giro
      // Il server ha rifiutato la richiesta (es. 422/500): non ha senso ritentarla
      // all'infinito, altrimenti resta bloccata in coda per sempre.
      console.error('Richiesta accodata rifiutata dal server, rimossa dalla coda', req, e.response.status)
      await db.delete(STORE, req.id)
    }
  }

  return flushedAny
}

// Flush al ripristino della connessione di rete (utile quando il dispositivo
// torna online dopo un vero distacco Wi-Fi).
if (typeof window !== 'undefined') {
  window.addEventListener('online', flushQueue)
}
