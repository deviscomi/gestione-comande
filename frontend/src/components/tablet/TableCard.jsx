import { useNavigate } from 'react-router-dom'

const BG = {
  libero:   'var(--color-background-primary)',
  occupato: 'var(--color-background-warning)',
  in_corso: 'var(--color-background-info)',
}
const BORDER = {
  libero:   'var(--color-border-tertiary)',
  occupato: 'var(--color-border-warning)',
  in_corso: 'var(--color-border-info)',
}

export default function TableCard({ table }) {
  const navigate = useNavigate()
  const order = table.active_order
  const pendingCount = order?.pending_count ?? 0

  function handleClick() {
    if (table.status === 'libero') {
      navigate(`/tables/${table.id}`)
    } else {
      navigate(`/tables/${table.id}/order`)
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
        background: BG[table.status] ?? BG.libero,
        border: `2px solid ${pendingCount > 0 ? 'var(--color-border-danger)' : (BORDER[table.status] ?? BORDER.libero)}`,
        width: '100%', transition: 'opacity .1s',
        position: 'relative',
      }}
    >
      {/* Badge pending — visibile solo se ci sono articoli non inviati */}
      {pendingCount > 0 && (
        <span style={{
          position: 'absolute', top: -7, right: -7,
          background: 'var(--color-background-danger)',
          color: 'var(--color-text-danger)',
          border: '1.5px solid var(--color-border-danger)',
          borderRadius: '50%',
          width: 20, height: 20,
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>
          {pendingCount}
        </span>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          {table.number}{table.suffix ? ` ${table.suffix}` : ''}
        </span>
        {order && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-info)' }}>
            € {Number(order.total ?? 0).toFixed(2)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {table.status === 'libero' ? 'Libero' : `${order?.covers ?? 0} cop.`}
        </span>
        {pendingCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: 'var(--color-text-danger)',
            background: 'var(--color-background-danger)',
            border: '1px solid var(--color-border-danger)',
            borderRadius: 4, padding: '1px 5px',
          }}>
            {pendingCount} da inviare
          </span>
        )}
      </div>
    </button>
  )
}
