import axios from 'axios'
import { queueRequest } from './offlineQueue'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Upload multipart (es. import dati): l'istanza ha 'Content-Type: application/json'
  // di default; con un FormData axios lo serializzerebbe in JSON e il file andrebbe perso.
  // Rimuovendo il Content-Type qui, è il browser a impostare
  // 'multipart/form-data; boundary=...' — indispensabile a PHP per leggere il file.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }

  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth-store')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    // Nessuna risposta dal server = connessione assente.
    // Le mutazioni (non-GET) vengono salvate in IndexedDB e
    // riprovate automaticamente al ripristino della connessione.
    if (!err.response && err.config && err.config.method !== 'get') {
      queueRequest({
        method: err.config.method,
        url:    err.config.url,
        data:   err.config.data,
      })
    }

    return Promise.reject(err)
  }
)

export default api
