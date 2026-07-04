import { openDB } from 'idb'

const DB_NAME = 'comande-offline'
export const STORE = 'pending-requests'

export async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    },
  })
}

export async function queueRequest(request) {
  const db = await getDb()
  await db.add(STORE, { ...request, timestamp: Date.now() })
}

export async function getPendingCount() {
  const db = await getDb()
  return db.count(STORE)
}
