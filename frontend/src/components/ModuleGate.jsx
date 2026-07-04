import { useModule } from '../hooks/useModule'

export default function ModuleGate({ slug, children, fallback = null }) {
  const active = useModule(slug)
  return active ? children : fallback
}
