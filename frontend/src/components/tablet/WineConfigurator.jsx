import { useState } from 'react'
import { UscitaSelector } from './DishConfigurator'

export default function WineConfigurator({ wine, onAdd, onClose }) {
  const [quantity, setQuantity] = useState(1)
  const [notes,    setNotes]    = useState('')
  const [uscita,   setUscita]   = useState(1)

  const totalPrice = (parseFloat(wine?.price ?? 0) * quantity).toFixed(2)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-background-primary)',
        borderRadius: '0 0 16px 16px',
        padding: 16, width: '100%', maxWidth: 520,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,.2)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{wine?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {[wine?.producer, wine?.vintage_year].filter(Boolean).join(' ')}
              {(wine?.producer || wine?.vintage_year) ? ' · ' : ''}
              € {Number(wine?.price ?? 0).toFixed(2)} cad.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22,
            color: 'var(--color-text-secondary)', padding: 0, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Quantità */}
        <Row label="Quantità">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={btnStyle}>−</button>
          <span style={{ fontSize: 16, fontWeight: 600, minWidth: 28, textAlign: 'center' }}>{quantity}</span>
          <button onClick={() => setQuantity(q => Math.min(20, q + 1))} style={btnStyle}>+</button>
        </Row>

        {/* Uscita */}
        <UscitaSelector value={uscita} onChange={setUscita} />

        {/* Note libere */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Note</div>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Note…"
            style={{
              width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 8,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-info)' }}>
            € {totalPrice}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)', cursor: 'pointer',
            }}>Annulla</button>
            <button
              onClick={() => onAdd({ quantity, notes: notes.trim() || null, uscita })}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', cursor: 'pointer',
              }}
            >Aggiungi</button>
          </div>
        </div>

      </div>
    </div>
  )
}

const btnStyle = {
  width: 30, height: 30, borderRadius: 6, fontSize: 18, lineHeight: 1,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)', cursor: 'pointer',
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 70 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>
    </div>
  )
}
