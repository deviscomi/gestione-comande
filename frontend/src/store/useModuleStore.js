import { create } from 'zustand'
import api from '../api/axios'

export const useModuleStore = create((set) => ({
  modules: {},   // { [slug]: boolean }
  license: null, // { licensee_name, tier, expires_at, is_expired }
  loaded: false,

  fetchModules: async (retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data } = await api.get('/license')
        const modules = Object.fromEntries(
          data.modules.map(m => [m.slug, m.is_active])
        )
        set({ modules, license: data, loaded: true })
        return
      } catch (e) {
        // 401 = non autenticato: inutile ritentare (l'interceptor gestisce il logout).
        if (e?.response?.status === 401) break
        // Errore transitorio (rete/5xx): riprova con backoff lineare.
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * attempt))
        }
      }
    }
    // Esauriti i tentativi: i moduli opzionali restano disattivi ma la SPA parte.
    set({ loaded: true })
  },
}))
