import { useNavigate } from 'react-router-dom'
import Tables from '../admin/Tables'
import BottomNavBar from '../../components/tablet/BottomNavBar'

export default function ManageTables() {
  const navigate = useNavigate()

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background-primary)' }}>
      {/* TopBar */}
      <div style={{
        padding: '10px 14px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
      }}>
        <button onClick={() => navigate('/')} style={{
          fontSize: 18, background: 'none', border: 'none',
          color: 'var(--color-text-secondary)', padding: 0
        }}>←</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Gestisci tavoli e zone</span>
      </div>

      {/* Contenuto: componente Tables riutilizzato dall'admin */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 60 }}>
        <Tables />
      </div>

      <BottomNavBar active="tables" />
    </div>
  )
}
