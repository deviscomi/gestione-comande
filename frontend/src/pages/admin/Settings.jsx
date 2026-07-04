import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

export default function Settings() {
  const [values, setValues] = useState({
    tablet_pin:            '',
    inactivity_timeout:    '',
    close_table_message:   '',
    coperto_price:         '',
    log_retention_months:  '',
  })
  const [showPin, setShowPin] = useState(false)
  const [saved,   setSaved]   = useState(false)

  const { data } = useQuery({
    queryKey: ['settings-all'],
    queryFn: () => adminApi.getSettings().then(r => r.data),
  })

  useEffect(() => {
    if (data) setValues({
      tablet_pin:            data.tablet_pin            ?? '',
      inactivity_timeout:    data.inactivity_timeout    ?? '',
      close_table_message:   data.close_table_message   ?? '',
      coperto_price:         data.coperto_price         ?? '0',
      log_retention_months:  data.log_retention_months  ?? '6',
    })
  }, [data])

  const saveMut = useMutation({
    mutationFn: async () => {
      await Promise.all(Object.entries(values).map(([key, val]) => adminApi.updateSetting(key, val)))
    },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000) },
  })

  const fields = [
    {
      key:    'tablet_pin',
      label:  'PIN tablet',
      type:   showPin ? 'text' : 'password',
      suffix: (
        <button onClick={() => setShowPin(s => !s)} style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 6,
          border: '1px solid var(--color-border-secondary)',
          background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer',
        }}>
          {showPin ? 'Nascondi' : 'Mostra'}
        </button>
      ),
    },
    { key: 'inactivity_timeout',  label: 'Timeout inattività (secondi)', type: 'number' },
    { key: 'close_table_message', label: 'Messaggio chiusura tavolo', textarea: true },
    {
      key:   'coperto_price',
      label: 'Coperto (€ per persona)',
      type:  'number',
      hint:  'Importo addebitato per ogni coperto. Inserisci 0 per disabilitare.',
      step:  '0.50',
      min:   '0',
    },
    {
      key:   'log_retention_months',
      label: 'Retention log attività (mesi)',
      type:  'number',
      hint:  'Da quanti mesi conservare i log attività prima della pulizia automatica mensile.',
      step:  '1',
      min:   '1',
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Impostazioni sistema</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && <span style={{ fontSize: 12, color: 'var(--color-text-success)' }}>✓ Salvato</span>}
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} style={{
            padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            opacity: saveMut.isPending ? 0.7 : 1,
          }}>{saveMut.isPending ? 'Salvataggio...' : 'Salva modifiche'}</button>
        </div>
      </div>

      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
          {f.hint && (
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{f.hint}</div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {f.textarea ? (
              <textarea
                value={values[f.key]}
                onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                rows={3}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13,
                  border: '1px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)', resize: 'vertical',
                }}
              />
            ) : (
              <input
                type={f.type ?? 'text'}
                step={f.step}
                min={f.min}
                value={values[f.key]}
                onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13,
                  border: '1px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                }}
              />
            )}
            {f.suffix}
          </div>
        </div>
      ))}
    </div>
  )
}
