import { useNavigate } from 'react-router-dom'

const ITEMS = [
  { key: 'tables', label: 'Tavoli', icon: '⊞', path: '/' },
]

export default function BottomNavBar({ active }) {
  const navigate = useNavigate()
  return (
    <nav style={{
      height: 52, background: 'var(--color-background-secondary)',
      borderTop: '1px solid var(--color-border-tertiary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40
    }}>
      {ITEMS.map(item => (
        <button key={item.key} onClick={() => navigate(item.path)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          background: 'none', border: 'none', padding: '4px 12px',
          color: active === item.key ? 'var(--color-text-info)' : 'var(--color-text-tertiary)',
          fontSize: 10, fontWeight: active === item.key ? 600 : 400
        }}>
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
