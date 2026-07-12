import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from './store/useAuthStore'
import { useModuleStore } from './store/useModuleStore'
import { flushQueue } from './hooks/useOfflineQueue'
import Licenza from './pages/admin/Licenza'
import PinLock from './pages/tablet/PinLock'
import Login from './pages/tablet/Login'
import TableList from './pages/tablet/TableList'
import TableDetail from './pages/tablet/TableDetail'
import OrderScreen from './pages/tablet/OrderScreen'
import ManageTables from './pages/tablet/ManageTables'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import MenuKitchen from './pages/admin/MenuKitchen'
import MenuBar from './pages/admin/MenuBar'
import MenuPizzeria from './pages/admin/MenuPizzeria'
import MenuVini from './pages/admin/MenuVini'
import Tables from './pages/admin/Tables'
import Zones from './pages/admin/Zones'
import Waiters from './pages/admin/Waiters'
import Printers from './pages/admin/Printers'
import FiscalDevices from './pages/admin/FiscalDevices'
import FiscalReceipts from './pages/admin/FiscalReceipts'
import ServiceSchedule from './pages/admin/ServiceSchedule'
import Reports from './pages/admin/Reports'
import OrderHistory from './pages/admin/OrderHistory'
import DailyClosure from './pages/admin/DailyClosure'
import Settings from './pages/admin/Settings'
import ImportExport from './pages/admin/ImportExport'
import ActivityLogs from './pages/admin/ActivityLogs'
import KdsHelp from './pages/admin/KdsHelp'
import KdsGate from './pages/kds/KdsGate'
import CashierDashboard from './pages/cashier/CashierDashboard'
import CashierTableView from './pages/cashier/CashierTableView'
import ModuleGate from './components/ModuleGate'
import ModuloDisattivato from './components/ModuloDisattivato'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'

function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'super_admin'
}

function isCashier(user) {
  return user?.role === 'cashier'
}

function TabletRoute({ children }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (isAdmin(user) || isCashier(user)) return <Navigate to="/admin" replace />
  return children
}

// Pannello backoffice: ammette admin e cashier. La sidebar ridotta per il cashier
// è gestita in AdminLayout; le pagine sensibili restano protette da AdminOnlyRoute.
function AdminRoute({ children }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (!isAdmin(user) && !isCashier(user)) return <Navigate to="/" replace />
  return children
}

// Route nested riservate al solo admin: se il cashier ci naviga con un URL diretto,
// torna alla Dashboard invece di restare bloccato su una pagina che non può usare.
function AdminOnlyRoute({ children }) {
  const { user } = useAuthStore()
  if (!isAdmin(user)) return <Navigate to="/admin" replace />
  return children
}

function CashierRoute({ children }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (!isCashier(user) && !isAdmin(user)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { token } = useAuthStore()
  const fetchModules = useModuleStore(s => s.fetchModules)
  const qc = useQueryClient()

  useEffect(() => {
    if (token) fetchModules()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // La coda offline va ritentata periodicamente, non solo all'evento 'online':
  // su LAN locale il tablet resta spesso connesso al Wi-Fi anche quando il
  // backend è temporaneamente irraggiungibile, quindi l'evento 'online' del
  // browser non scatta mai e una richiesta accodata (es. apertura tavolo)
  // rimarrebbe bloccata per sempre.
  useEffect(() => {
    if (!token) return
    const tick = async () => {
      if (await flushQueue()) qc.invalidateQueries()
    }
    tick()
    const interval = setInterval(tick, 20000)
    return () => clearInterval(interval)
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notifica quando una o più azioni salvate offline non sono state applicate
  // (richiesta non valida o troppi errori server): niente scarto silenzioso.
  useEffect(() => {
    const onDropped = (e) => {
      const n = e.detail?.length ?? 0
      if (n > 0) {
        window.alert(
          `${n} azione/i salvata/e offline non ${n === 1 ? 'è stata applicata' : 'sono state applicate'} ` +
          `(richiesta non valida o errore del server). Verifica lo stato e riprova manualmente.`
        )
      }
    }
    window.addEventListener('offline-queue-dropped', onDropped)
    return () => window.removeEventListener('offline-queue-dropped', onDropped)
  }, [])

  return (
    <>
      <PinLock />
      <PwaUpdatePrompt />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Tablet cameriere */}
        <Route path="/" element={<TabletRoute><TableList /></TabletRoute>} />
        <Route path="/tables/:id" element={<TabletRoute><TableDetail /></TabletRoute>} />
        <Route path="/tables/:id/order" element={<TabletRoute><OrderScreen /></TabletRoute>} />
        <Route path="/manage-tables" element={<TabletRoute><ManageTables /></TabletRoute>} />

        {/* Admin backoffice */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="menu"     element={<AdminOnlyRoute><MenuKitchen /></AdminOnlyRoute>} />
          <Route path="bar"      element={<AdminOnlyRoute><MenuBar /></AdminOnlyRoute>} />
          <Route path="pizzeria" element={
            <ModuleGate slug="pizzeria" fallback={<ModuloDisattivato nome="Pizzeria" />}>
              <AdminOnlyRoute><MenuPizzeria /></AdminOnlyRoute>
            </ModuleGate>} />
          <Route path="vini"     element={<AdminOnlyRoute><MenuVini /></AdminOnlyRoute>} />
          <Route path="tables"   element={<Tables />} />
          <Route path="zones"    element={<AdminOnlyRoute><Zones /></AdminOnlyRoute>} />
          <Route path="waiters"  element={
            <ModuleGate slug="advanced_backoffice" fallback={<ModuloDisattivato nome="Backoffice avanzato" />}>
              <AdminOnlyRoute><Waiters /></AdminOnlyRoute>
            </ModuleGate>} />
          <Route path="printers" element={
            <ModuleGate slug="printing" fallback={<ModuloDisattivato nome="Stampa" />}>
              <AdminOnlyRoute><Printers /></AdminOnlyRoute>
            </ModuleGate>} />
          <Route path="fiscal-devices" element={
            <ModuleGate slug="fiscal" fallback={<ModuloDisattivato nome="Scontrini fiscali" />}>
              <AdminOnlyRoute><FiscalDevices /></AdminOnlyRoute>
            </ModuleGate>} />
          <Route path="fiscal-receipts" element={
            <ModuleGate slug="fiscal" fallback={<ModuloDisattivato nome="Scontrini fiscali" />}>
              <FiscalReceipts />
            </ModuleGate>} />
          <Route path="schedule" element={<ServiceSchedule />} />
          <Route path="reports"  element={
            <ModuleGate slug="reports" fallback={<ModuloDisattivato nome="Report" />}>
              <Reports />
            </ModuleGate>} />
          <Route path="history"  element={<OrderHistory />} />
          <Route path="closure"  element={
            <ModuleGate slug="daily_closure" fallback={<ModuloDisattivato nome="Chiusura giornaliera" />}>
              <DailyClosure />
            </ModuleGate>} />
          <Route path="settings" element={<AdminOnlyRoute><Settings /></AdminOnlyRoute>} />
          <Route path="import-export" element={
            <ModuleGate slug="advanced_backoffice" fallback={<ModuloDisattivato nome="Backoffice avanzato" />}>
              <AdminOnlyRoute><ImportExport /></AdminOnlyRoute>
            </ModuleGate>} />
          <Route path="logs"     element={
            <ModuleGate slug="advanced_backoffice" fallback={<ModuloDisattivato nome="Backoffice avanzato" />}>
              <AdminOnlyRoute><ActivityLogs /></AdminOnlyRoute>
            </ModuleGate>} />
          <Route path="kds"      element={
            <ModuleGate slug="kds" fallback={<ModuloDisattivato nome="KDS" />}>
              <AdminOnlyRoute><KdsHelp /></AdminOnlyRoute>
            </ModuleGate>} />
          <Route path="licenza"  element={<AdminOnlyRoute><Licenza /></AdminOnlyRoute>} />
        </Route>

        {/* Cassa — pagamenti parziali / conti separati */}
        <Route path="/cassa" element={<CashierRoute><CashierDashboard /></CashierRoute>} />
        <Route path="/cassa/tavoli/:id" element={<CashierRoute><CashierTableView /></CashierRoute>} />

        {/* KDS — Kitchen Display System (nessun login; gated dal modulo kds) */}
        <Route path="/kds/cucina"   element={<KdsGate department="cucina" />} />
        <Route path="/kds/pizzeria" element={<KdsGate department="pizzeria" />} />
        <Route path="/kds/bar"      element={<KdsGate department="bar" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
