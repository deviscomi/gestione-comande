import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY || 'comande-key',
  wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
  // Con host/porta vuoti (build di produzione) Echo usa la pagina servita: Reverb è
  // proxato da nginx sulla stessa porta dell'app → ws://<host-della-pagina>/app/<key>.
  // Porta '' su http:80 → 80, '' su https:443 → 443. In dev restano i valori di VITE_*.
  wsPort: import.meta.env.VITE_REVERB_PORT || window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
  wssPort: import.meta.env.VITE_REVERB_PORT || window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
  forceTLS: window.location.protocol === 'https:',
  enabledTransports: ['ws', 'wss'],
  authEndpoint: '/api/v1/broadcasting/auth',
  auth: {
    headers: {
      // Getter: letto ad ogni auth request, non al boot del modulo.
      // Garantisce che il token aggiornato dopo il login sia sempre usato.
      get Authorization() {
        return `Bearer ${localStorage.getItem('auth_token') ?? ''}`
      },
    },
  }
})

export default echo
