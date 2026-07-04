import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/axios'

export const useSettingsStore = create(persist(
  (set) => ({
    pin: '1234',
    timeout: 300,
    closeTableMessage: 'Confermi la chiusura del tavolo? I dati andranno persi.',

    fetchSettings: async () => {
      try {
        const [pinRes, timeoutRes, msgRes] = await Promise.all([
          api.get('/settings/tablet_pin'),
          api.get('/settings/inactivity_timeout'),
          api.get('/settings/close_table_message').catch(() => ({ data: { value: 'Confermi la chiusura del tavolo?' } })),
        ])
        set({
          pin: pinRes.data.value,
          timeout: parseInt(timeoutRes.data.value, 10),
          closeTableMessage: msgRes.data.value,
        })
      } catch {
        // usa i default se offline
      }
    },
  }),
  { name: 'settings-store' }
))
