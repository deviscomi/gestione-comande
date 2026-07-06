import { useModuleStore } from '../store/useModuleStore'

// Avviso NON bloccante sullo stato della licenza (decisione di prodotto: nessun
// enforcement). Mostra un banner se la licenza è scaduta o in scadenza a breve.
const SOON_DAYS = 14

export default function LicenseBanner() {
  const license = useModuleStore(s => s.license)
  if (!license) return null

  const expiresAt = license.expires_at ? new Date(license.expires_at) : null
  const daysLeft = expiresAt ? Math.ceil((expiresAt - new Date()) / 86400000) : null

  const expired = !!license.is_expired
  const expiringSoon = !expired && daysLeft !== null && daysLeft >= 0 && daysLeft <= SOON_DAYS

  if (!expired && !expiringSoon) return null

  const dateStr = expiresAt?.toLocaleDateString('it-IT')
  const message = expired
    ? `Licenza scaduta il ${dateStr}. Il sistema resta pienamente operativo; contatta il fornitore per il rinnovo.`
    : `La licenza scade tra ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'} (${dateStr}). Contatta il fornitore per il rinnovo.`

  return (
    <div style={{
      background: expired ? 'var(--color-background-danger)' : 'var(--color-background-warning)',
      color:      expired ? 'var(--color-text-danger)'       : 'var(--color-text-warning)',
      padding: '8px 16px',
      fontSize: 13,
      fontWeight: 600,
      textAlign: 'center',
      flexShrink: 0,
    }}>
      ⚠ {message}
    </div>
  )
}
