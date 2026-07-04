// Mostrata al posto di una pagina di modulo quando il relativo modulo è spento
// nella licenza corrente (raggiunta via URL diretto / link salvato).
export default function ModuloDisattivato({ nome }) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 24,
      textAlign: 'center',
      color: 'var(--color-text-secondary)',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
        Modulo non attivo
      </div>
      <div style={{ fontSize: 13, maxWidth: 420, lineHeight: 1.5 }}>
        {nome ? `Il modulo “${nome}” non è ` : 'Questa funzionalità non è '}
        incluso in questa licenza. Contatta l'amministratore per attivarlo.
      </div>
    </div>
  )
}
