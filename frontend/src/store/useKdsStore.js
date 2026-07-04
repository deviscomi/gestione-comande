import { create } from 'zustand'

const COMANDE_PER_PAGE = 4

export const useKdsStore = create((set, get) => ({
  comande: [],
  department: null,
  viewOffset: 0,
  COMANDE_PER_PAGE,

  setComande: (comande) => set({ comande, viewOffset: 0 }),

  setDepartment: (dept) => set({ department: dept }),

  updateUscitaStatus: (orderId, kdsStatusId, status, statusUpdatedAt) =>
    set((state) => ({
      comande: state.comande.map((c) =>
        c.order_id === orderId
          ? {
              ...c,
              uscite: c.uscite.map((u) =>
                u.kds_status_id === kdsStatusId
                  ? { ...u, status, status_updated_at: statusUpdatedAt }
                  : u
              ),
            }
          : c
      ),
    })),

  updateOtherDeptStatus: (orderId, uscita, otherDept, otherStatus) =>
    set((state) => ({
      comande: state.comande.map((c) =>
        c.order_id === orderId
          ? {
              ...c,
              uscite: c.uscite.map((u) =>
                u.uscita === uscita
                  ? {
                      ...u,
                      other_departments: (u.other_departments ?? []).map((od) =>
                        od.department === otherDept ? { ...od, status: otherStatus } : od
                      ),
                      // Vista bar: aggiorna lo stato del reparto chiamato (es. "al lavoro"/"pronta")
                      call_targets: (u.call_targets ?? []).map((t) =>
                        t.department === otherDept ? { ...t, status: otherStatus } : t
                      ),
                    }
                  : u
              ),
            }
          : c
      ),
    })),

  // Segna come "chiamata" un'uscita: su cucina/pizzeria toglie l'overlay IN ATTESA
  // (match su kds_status_id proprio); sul bar segna chiamato il call_target corrispondente.
  markCalled: (orderId, kdsStatusId) =>
    set((state) => ({
      comande: state.comande.map((c) =>
        c.order_id === orderId
          ? {
              ...c,
              uscite: c.uscite.map((u) => ({
                ...u,
                called: u.kds_status_id === kdsStatusId ? true : u.called,
                call_targets: (u.call_targets ?? []).map((t) =>
                  t.kds_status_id === kdsStatusId ? { ...t, called: true } : t
                ),
              })),
            }
          : c
      ),
    })),

  markComplete: (orderId, completedAt) =>
    set((state) => ({
      comande: state.comande.map((c) =>
        c.order_id === orderId ? { ...c, completed_at: completedAt } : c
      ),
    })),

  removeComanda: (orderId) =>
    set((state) => {
      const newComande = state.comande.filter((c) => c.order_id !== orderId)
      const maxOffset = Math.max(0, Math.floor((newComande.length - 1) / COMANDE_PER_PAGE) * COMANDE_PER_PAGE)
      return { comande: newComande, viewOffset: Math.min(state.viewOffset, maxOffset) }
    }),

  nextPage: () =>
    set((state) => {
      const totalPgs = Math.max(1, Math.ceil(state.comande.length / COMANDE_PER_PAGE))
      const maxOffset = (totalPgs - 1) * COMANDE_PER_PAGE
      return { viewOffset: Math.min(state.viewOffset + COMANDE_PER_PAGE, maxOffset) }
    }),

  prevPage: () =>
    set((state) => ({ viewOffset: Math.max(0, state.viewOffset - COMANDE_PER_PAGE) })),

  visibleComande: () => {
    const { comande, viewOffset } = get()
    return comande.slice(viewOffset, viewOffset + COMANDE_PER_PAGE)
  },

  hiddenCount: () => {
    const { comande, viewOffset } = get()
    return Math.max(0, comande.length - viewOffset - COMANDE_PER_PAGE)
  },

  currentPage: () => {
    const { viewOffset } = get()
    return Math.floor(viewOffset / COMANDE_PER_PAGE) + 1
  },

  totalPages: () => {
    const { comande } = get()
    return Math.max(1, Math.ceil(comande.length / COMANDE_PER_PAGE))
  },
}))
