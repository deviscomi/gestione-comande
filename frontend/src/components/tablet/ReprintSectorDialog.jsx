import { useState } from 'react'

const SECTOR_LABELS = {
  cassiere: 'Cassa',
  cucina:   'Cucina',
  pizzeria: 'Pizzeria',
  bar:      'Bar',
}

export default function ReprintSectorDialog({ printJobs, onConfirm, onCancel, isPending }) {
  const [selectedJobId, setSelectedJobId] = useState(null)

  const latestByType = (printJobs ?? [])
    .filter(job => SECTOR_LABELS[job.print_type])
    .reduce((acc, job) => {
      if (!acc[job.print_type] || job.id > acc[job.print_type].id) {
        acc[job.print_type] = job
      }
      return acc
    }, {})

  const sectors = Object.keys(SECTOR_LABELS)
    .filter(type => latestByType[type])
    .map(type => latestByType[type])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 340, padding: 24, borderRadius: 16,
        background: 'var(--color-background-primary)',
        border: '1px solid var(--color-border-tertiary)',
        boxShadow: '0 8px 32px rgba(0,0,0,.15)'
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Ristampa singolo settore</h3>

        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Scegli quale comanda di reparto ristampare. Verrà ristampato solo il settore selezionato.
        </div>

        {sectors.length === 0 ? (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 16,
            background: 'var(--color-background-danger)',
            border: '1px solid var(--color-border-danger)',
            fontSize: 12, color: 'var(--color-text-danger)'
          }}>
            Nessuna comanda di reparto trovata per l'ultimo invio.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {sectors.map(job => (
              <label key={job.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: selectedJobId === job.id ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                border: `1px solid ${selectedJobId === job.id ? 'var(--color-border-info)' : 'var(--color-border-secondary)'}`,
                cursor: 'pointer', transition: 'all .15s', userSelect: 'none'
              }}>
                <input
                  type="radio"
                  name="reprint-sector"
                  checked={selectedJobId === job.id}
                  onChange={() => setSelectedJobId(job.id)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {SECTOR_LABELS[job.print_type]}
                </div>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
          }}>Annulla</button>
          <button
            onClick={() => onConfirm(selectedJobId)}
            disabled={!selectedJobId || isPending}
            style={{
              flex: 2, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: (!selectedJobId || isPending) ? 'var(--color-background-secondary)' : 'var(--color-primary)',
              color: (!selectedJobId || isPending) ? 'var(--color-text-tertiary)' : '#fff',
              border: 'none', transition: 'all .15s'
            }}
          >{isPending ? 'Ristampa...' : 'Ristampa'}</button>
        </div>
      </div>
    </div>
  )
}
