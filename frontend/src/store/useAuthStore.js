import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../api/axios'
import { useModuleStore } from './useModuleStore'

export const useAuthStore = create(persist(
  (set) => ({
    user: null,
    token: null,
    login: async (username, password) => {
      const { data } = await api.post('/auth/login', { username, password })
      localStorage.setItem('auth_token', data.token)
      set({ user: data.user, token: data.token })
      await useModuleStore.getState().fetchModules()
    },
    logout: async () => {
      try { await api.post('/auth/logout') } catch {}
      localStorage.removeItem('auth_token')
      set({ user: null, token: null })
    }
  }),
  { name: 'auth-store' }
))
