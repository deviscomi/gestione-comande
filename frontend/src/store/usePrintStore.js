import { create } from 'zustand'

export const usePrintStore = create((set) => ({
  printJobs: [],
  setPrintJobs: (jobs) => set({ printJobs: jobs }),
  updateJobStatus: (jobId, status) =>
    set((state) => ({
      printJobs: state.printJobs.map((j) =>
        j.id === jobId ? { ...j, status } : j
      )
    })),
  addJob: (job) =>
    set((state) => ({ printJobs: [...state.printJobs, job] }))
}))
