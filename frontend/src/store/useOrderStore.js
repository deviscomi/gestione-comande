import { create } from 'zustand'

export const useOrderStore = create((set, get) => ({
  currentOrder: null,
  orderItems: [],
  setCurrentOrder: (order) => set({ currentOrder: order }),
  setOrderItems: (items) => set({ orderItems: items }),
  addItem: (item) =>
    set((state) => ({ orderItems: [...state.orderItems, item] })),
  removeItem: (itemId) =>
    set((state) => ({
      orderItems: state.orderItems.filter((i) => i.id !== itemId)
    })),
  clearOrder: () => set({ currentOrder: null, orderItems: [] }),

  // Restituisce il numero massimo di uscita tra tutti gli articoli correnti
  getMaxUscita: () => {
    const items = get().orderItems
    if (!items || items.length === 0) return 1
    return Math.max(1, ...items.map((i) => i.uscita ?? 1))
  },
}))
