import { create } from 'zustand'

export const useTableStore = create((set) => ({
  tables: [],
  selectedTable: null,
  setTables: (tables) => set({ tables }),
  setSelectedTable: (table) => set({ selectedTable: table }),
  updateTableStatus: (tableId, status) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, status } : t
      )
    }))
}))
