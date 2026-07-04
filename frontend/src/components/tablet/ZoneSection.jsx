import { useState } from 'react'
import TableCard from './TableCard'

export default function ZoneSection({ zone, onUpdate }) {
  const [collapsed, setCollapsed] = useState(false)
  const tables = zone.tables ?? []
  const busyCount = tables.filter(t => t.status !== 'libero').length

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 4px', background: 'none', border: 'none',
          fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600, cursor: 'pointer'
        }}
      >
        <span>{zone.name.toUpperCase()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {busyCount > 0 && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 8,
              background: 'var(--color-background-info)', color: 'var(--color-text-info)'
            }}>{busyCount} occupati</span>
          )}
          <span style={{ fontSize: 16 }}>{collapsed ? '▶' : '▼'}</span>
        </div>
      </button>

      {!collapsed && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 8
        }}>
          {tables.map(table => (
            <TableCard key={table.id} table={table} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
