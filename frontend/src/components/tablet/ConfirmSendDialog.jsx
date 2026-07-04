import { useState } from 'react'

export default function ConfirmSendDialog({ order, pendingCount, hasPizzas, onConfirm, onCancel, isPending }) {
  const [allSpicchi, setAllSpicchi] = useState(false)
  const coversOk = (order?.covers ?? 0) > 0

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
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Invia comanda</h3>

        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Stai per inviare <strong>{pendingCount}</strong> articoli
          {hasPizzas ? ' (con pizze)' : ''} al tavolo <strong>{order?.table?.number ?? order?.table_id}</strong>.
        </div>

        {!coversOk && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 14,
            background: 'var(--color-background-danger)',
            border: '1px solid var(--color-border-danger)',
            fontSize: 12, color: 'var(--color-text-danger)'
          }}>
            ⚠️ Inserisci il numero di coperti prima di inviare
          </div>
        )}

        {/* Tutte a spicchi — solo se ci sono pizze */}
        {hasPizzas && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, marginBottom: 16,
            background: allSpicchi ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
            border: `1px solid ${allSpicchi ? 'var(--color-border-info)' : 'var(--color-border-secondary)'}`,
            cursor: 'pointer', transition: 'all .15s', userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={allSpicchi}
              onChange={e => setAllSpicchi(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Tutte a spicchi 🍕
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                Imposta taglio a spicchi per tutte le pizze di questo invio
              </div>
            </div>
          </label>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
          }}>Annulla</button>
          <button
            onClick={() => onConfirm(allSpicchi)}
            disabled={!coversOk || isPending}
            style={{
              flex: 2, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: (!coversOk || isPending) ? 'var(--color-background-secondary)' : 'var(--color-primary)',
              color: (!coversOk || isPending) ? 'var(--color-text-tertiary)' : '#fff',
              border: 'none', transition: 'all .15s'
            }}
          >{isPending ? 'Invio...' : 'Conferma invio'}</button>
        </div>
      </div>
    </div>
  )
}
