import { create } from 'zustand'

// Selezione corrente in cassa: mappa chiave riga/coperto -> { type, orderItemId, quantity, unitPrice }
// Stato volatile (no persist) — si azzera ad ogni pagamento confermato o cambio tavolo.
export const useCashierSelectionStore = create((set, get) => ({
  selection: {},

  selectFull: (key, { type, orderItemId, quantity, unitPrice }) => {
    if (quantity <= 0) return
    set(state => ({
      selection: { ...state.selection, [key]: { type, orderItemId, quantity, unitPrice } },
    }))
  },

  setQuantity: (key, qty, { type, orderItemId, unitPrice, maxQty }) => {
    const clamped = Math.max(0, Math.min(qty, maxQty))
    set(state => {
      const next = { ...state.selection }
      if (clamped <= 0) {
        delete next[key]
      } else {
        next[key] = { type, orderItemId, quantity: clamped, unitPrice }
      }
      return { selection: next }
    })
  },

  clear: () => set({ selection: {} }),

  getSubtotal: () => {
    return Object.values(get().selection)
      .reduce((sum, s) => sum + s.quantity * Number(s.unitPrice), 0)
  },

  getAllocations: () => {
    return Object.values(get().selection).map(s => ({
      allocation_type: s.type,
      order_item_id:   s.orderItemId,
      quantity:        s.quantity,
    }))
  },
}))
