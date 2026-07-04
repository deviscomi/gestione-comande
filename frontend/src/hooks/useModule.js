import { useModuleStore } from '../store/useModuleStore'

export function useModule(slug) {
  return useModuleStore(state => state.modules[slug] ?? false)
}
