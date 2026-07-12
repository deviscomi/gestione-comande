import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/useAuthStore'
import { useModuleStore } from '../../store/useModuleStore'
import { adminApi } from '../../api/endpoints/admin'
import ErrorBoundary from '../../components/ErrorBoundary'
import LicenseBanner from '../../components/LicenseBanner'

const NAV = [
  { to: '/admin',           icon: '⊞',  label: 'Dashboard',      end: true, cashier: true },
  { to: '/cassa',           icon: '💶', label: 'Cassa',                     cashier: true },
  { to: '/admin/menu',      icon: '🍽',  label: 'Menu cucina' },
  { to: '/admin/pizzeria',  icon: '🍕',  label: 'Menu pizzeria',  module: 'pizzeria' },
  { to: '/admin/vini',      icon: '🍷',  label: 'Menu vini' },
  { to: '/admin/bar',       icon: '🍹',  label: 'Menu bar' },
  { to: '/admin/tables',    icon: '🪑',  label: 'Tavoli & zone',             cashier: true },
  { to: '/admin/waiters',   icon: '👤',  label: 'Camerieri',      module: 'advanced_backoffice' },
  { to: '/admin/printers',  icon: '🖨',  label: 'Stampanti',  module: 'printing' },
  { to: '/admin/kds',       icon: '🖥',  label: 'KDS',            module: 'kds' },
  { to: '/admin/fiscal-devices', icon: '🧾', label: 'Registratori RT', module: 'fiscal' },
  { to: '/admin/fiscal-receipts', icon: '📄', label: 'Scontrini fiscali', module: 'fiscal', cashier: true },
  { to: '/admin/schedule',  icon: '📅',  label: 'Calendario',               cashier: true },
  { to: '/admin/reports',   icon: '📊',  label: 'Report',         module: 'reports', cashier: true },
  { to: '/admin/history',   icon: '📋',  label: 'Storico ordini',            cashier: true },
  { to: '/admin/closure',   icon: '🔒',  label: 'Chiusura',       module: 'daily_closure', cashier: true },
  { to: '/admin/settings',  icon: '⚙',  label: 'Impostazioni' },
  { to: '/admin/import-export', icon: '💾', label: 'Import/Export', module: 'advanced_backoffice' },
  { to: '/admin/logs',      icon: '📝',  label: 'Log attività',   module: 'advanced_backoffice' },
  { to: '/admin/licenza',   icon: '🔑',  label: 'Licenza' },
]

export default function AdminLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const modules = useModuleStore(s => s.modules)
  const loaded  = useModuleStore(s => s.loaded)
  const isCashierUser = user?.role === 'cashier'

  const { data: failedCount } = useQuery({
    queryKey: ['failed-jobs-count'],
    queryFn: () => adminApi.getFailedJobs().then(r => r.data.data?.length ?? 0),
    refetchInterval: 30000,
    enabled: !isCashierUser,
  })

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-background-primary)' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, background: 'var(--color-background-secondary)',
        borderRight: '1px solid var(--color-border-tertiary)',
        display: 'flex', flexDirection: 'column', padding: '12px 0',
        overflowY: 'auto', flexShrink: 0
      }}>
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Gestione Comande</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {user?.name} ({isCashierUser ? 'cassiere' : 'admin'})
          </div>
        </div>

        {NAV.filter(item => (!loaded || !item.module || modules[item.module]) && (!isCashierUser || item.cashier)).map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', fontSize: 13, textDecoration: 'none',
              color: isActive ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
              background: isActive ? 'var(--color-background-info)' : 'transparent',
              borderRadius: 6, margin: '1px 8px',
            })}>
            <span>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.to === '/admin/printers' && failedCount > 0 && (
              <span style={{
                background: 'var(--color-background-danger)',
                color: 'var(--color-text-danger)',
                borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700
              }}>{failedCount}</span>
            )}
          </NavLink>
        ))}

        <div style={{ marginTop: 'auto', padding: '12px 16px 4px' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '7px 0', borderRadius: 8, fontSize: 12,
            border: '1px solid var(--color-border-secondary)',
            background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer'
          }}>Esci</button>
        </div>
      </nav>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {/* Avviso non bloccante sullo stato della licenza (scaduta/in scadenza). */}
        <LicenseBanner />
        {/* Un crash in una pagina admin resta contenuto qui: la sidebar sopravvive. */}
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
