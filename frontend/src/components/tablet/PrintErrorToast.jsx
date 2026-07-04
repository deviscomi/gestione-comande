import { useMutation } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

export default function PrintErrorToast({ error, onDismiss }) {
  const retryMut = useMutation({
    mutationFn: () => adminApi.retryPrintJob(error.job_id),
    onSuccess: onDismiss,
  })

  const DEPT_LABEL = { cucina: 'Cucina', pizzeria: 'Pizzeria', cassiere: 'Cassa' }

  return (
    <div style={{
      position: 'fixed', bottom: 70, right: 12, zIndex: 300,
      width: 280, padding: 14, borderRadius: 10,
      background: 'var(--color-background-danger)',
      border: '1px solid var(--color-border-danger)',
      boxShadow: '0 4px 16px rgba(0,0,0,.15)',
      animation: 'fadeIn .2s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-danger)' }}>
          ⚠️ Stampa fallita — {DEPT_LABEL[error.print_type] ?? error.print_type}
        </span>
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', fontSize: 16,
          color: 'var(--color-text-danger)', padding: 0, cursor: 'pointer'
        }}>×</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
        La stampante non risponde. Puoi ritentare o stampare dal backoffice.
      </div>
      <button onClick={() => retryMut.mutate()} disabled={retryMut.isPending} style={{
        width: '100%', padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
        background: 'var(--color-text-danger)', color: '#fff', border: 'none',
        opacity: retryMut.isPending ? 0.7 : 1
      }}>
        {retryMut.isPending ? 'Retry...' : 'Riprova stampa'}
      </button>
    </div>
  )
}
