import { useModuleStore } from '../../store/useModuleStore'

const TIER_COLORS = {
  base:  { bg: 'var(--color-background-info)',    text: 'var(--color-text-info)' },
  pro:   { bg: 'var(--color-background-warning)', text: 'var(--color-text-warning)' },
  full:  { bg: 'var(--color-background-success)', text: 'var(--color-text-success)' },
}

function TierBadge({ tier }) {
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.base
  return (
    <span style={{
      background: colors.bg, color: colors.text,
      padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: 1,
    }}>{tier}</span>
  )
}

function ModuleCard({ module }) {
  return (
    <div style={{
      border: '1px solid var(--color-border-tertiary)',
      borderRadius: 10, padding: '14px 16px',
      background: 'var(--color-background-secondary)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{module.name}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
          background: module.is_active ? 'var(--color-background-success)' : 'var(--color-background-tertiary)',
          color: module.is_active ? 'var(--color-text-success)' : 'var(--color-text-tertiary)',
        }}>
          {module.is_active ? 'Attivo' : 'Non attivo'}
        </span>
      </div>
      {module.description && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
          {module.description}
        </p>
      )}
    </div>
  )
}

export default function Licenza() {
  const { license, loaded, fetchModules } = useModuleStore()

  if (!loaded) {
    return (
      <div style={{ padding: 32, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
        Caricamento...
      </div>
    )
  }

  const lic = license ?? {}
  const modules = lic.modules ?? []

  const expiryLabel = lic.expires_at
    ? new Date(lic.expires_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Nessuna scadenza'

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Licenza & Moduli</h2>

      {/* Banner scadenza */}
      {lic.is_expired && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 8,
          background: 'var(--color-background-danger)', color: 'var(--color-text-danger)',
          fontSize: 13, fontWeight: 600,
        }}>
          Licenza scaduta — contattare il fornitore per il rinnovo.
        </div>
      )}

      {/* Card licenza */}
      <div style={{
        border: '1px solid var(--color-border-tertiary)', borderRadius: 12,
        padding: '18px 20px', marginBottom: 24,
        background: 'var(--color-background-secondary)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{lic.licensee_name ?? '—'}</span>
          <TierBadge tier={lic.tier ?? 'base'} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          Validità: <strong style={{ color: 'var(--color-text-secondary)' }}>{expiryLabel}</strong>
        </div>
      </div>

      {/* Griglia moduli */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12, marginBottom: 20 }}>
        {modules.map(m => <ModuleCard key={m.slug} module={m} />)}
      </div>

      {/* Nota vendor */}
      <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '0 0 16px' }}>
        Per modificare i moduli attivi contattare il fornitore del software.
      </p>

      <button onClick={fetchModules} style={{
        padding: '7px 18px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        border: '1px solid var(--color-border-secondary)',
        background: 'transparent', color: 'var(--color-text-secondary)',
      }}>
        Aggiorna
      </button>
    </div>
  )
}
