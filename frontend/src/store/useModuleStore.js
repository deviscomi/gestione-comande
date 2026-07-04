import { create } from 'zustand'
import api from '../api/axios'

export const useModuleStore = create((set) => ({
  modules: {},   // { [slug]: boolean }
  license: null, // { licensee_name, tier, expires_at, is_expired }
  loaded: false,

  fetchModules: async () => {
    try {
      const { data } = await api.get('/license')
      const modules = Object.fromEntries(
        data.modules.map(m => [m.slug, m.is_active])
      )
      set({ modules, license: data, loaded: true })
    } catch {
      // In caso di errore i moduli opzionali restano disattivi
      set({ loaded: true })
    }
  },
}))
