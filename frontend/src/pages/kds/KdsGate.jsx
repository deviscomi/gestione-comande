import { useQuery } from '@tanstack/react-query'
import api from '../../api/axios'
import KdsDisplay from './KdsDisplay'

// Schermata a tutto schermo in stile KDS (dark), riusata per gli stati non-vivi.
function KdsScreen({ title, subtitle }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--kds-bg, #0f1115)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      userSelect: 'none',
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '0.15em',
        color: 'var(--kds-text-secondary, #c7ccd4)',
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 13,
          color: 'var(--kds-text-muted, #7a828e)',
          maxWidth: 420,
          lineHeight: 1.5,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

// Gate del display KDS: interroga /kds/enabled (pubblico) e monta il display
// vivo solo se il modulo `kds` è attivo. Con KDS spento (piano Base) mostra
// "Modulo non attivo" senza aprire WebSocket, polling coda o beep.
export default function KdsGate({ department }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kds-enabled'],
    queryFn: () => api.get('/kds/enabled').then((r) => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  })

  if (isLoading) return <KdsScreen title="CARICAMENTO…" />
  if (isError)   return <KdsScreen title="CONNESSIONE ASSENTE" subtitle="Impossibile contattare il server. Riprovo automaticamente." />
  if (!data?.enabled) {
    return (
      <KdsScreen
        title="MODULO NON ATTIVO"
        subtitle="Il Kitchen Display System non è incluso in questa licenza."
      />
    )
  }

  return <KdsDisplay department={department} />
}
