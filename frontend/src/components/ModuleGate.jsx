import { useModule } from '../hooks/useModule'
import { useModuleStore } from '../store/useModuleStore'

export default function ModuleGate({ slug, children, fallback = null }) {
  const active = useModule(slug)
  const loaded = useModuleStore(s => s.loaded)

  // Finché lo stato dei moduli non è caricato non decidere: evita di lampeggiare
  // il fallback "modulo non attivo" al refresh prima che /license risponda.
  if (!loaded) return null

  return active ? children : fallback
}
