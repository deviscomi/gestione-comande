import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ordersApi } from '../../api/endpoints/orders'
import { formatModDisplay } from '../../utils/modifications'

export default function OrderSummary({ order, onUpdate }) {
  const [editingItem, setEditingItem] = useState(null)   // { item, field: 'price'|'quantity', input }

  const deleteItemMut = useMutation({
    mutationFn: ({ orderId, itemId }) => ordersApi.deleteOrderItem(orderId, itemId),
    onSuccess: onUpdate,
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante l\'eliminazione'),
  })

  const updateItemMut = useMutation({
    mutationFn: ({ orderId, itemId, data }) => ordersApi.updateOrderItem(orderId, itemId, data),
    onSuccess: onUpdate,
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la modifica'),
  })

  const updatePriceMut = useMutation({
    mutationFn: ({ orderId, itemId, final_unit_price }) =>
      ordersApi.updateOrderItem(orderId, itemId, { final_unit_price }),
    onSuccess: () => { setEditingItem(null); onUpdate() },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la modifica del prezzo'),
  })

  const updateQuantityMut = useMutation({
    mutationFn: ({ orderId, itemId, quantity }) =>
      ordersApi.updateOrderItem(orderId, itemId, { quantity }),
    onSuccess: () => { setEditingItem(null); onUpdate() },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la modifica della quantità'),
  })

  const items     = order?.items ?? []
  const active    = items.filter(i => i.status !== 'cancelled')
  const cancelled = items.filter(i => i.status === 'cancelled')

  // Raggruppa articoli attivi per uscita, ordine crescente
  const itemsByUscita = useMemo(() => {
    return active.reduce((acc, item) => {
      const u = item.uscita ?? 1
      if (!acc[u]) acc[u] = []
      acc[u].push(item)
      return acc
    }, {})
  }, [active])

  const usciteKeys = Object.keys(itemsByUscita).map(Number).sort((a, b) => a - b)

  function openPriceEdit(item) {
    // Prezzo finale per unità (varianti incluse) = total_price / quantità
    const finalUnit = Number(item.total_price) / Number(item.quantity)
    setEditingItem({ item, field: 'price', input: finalUnit.toFixed(2) })
  }

  function confirmPriceEdit() {
    const newPrice = parseFloat(editingItem.input)
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Inserisci un prezzo valido')
      return
    }
    updatePriceMut.mutate({
      orderId:          order.id,
      itemId:           editingItem.item.id,
      final_unit_price: newPrice,
    })
  }

  function openQuantityEdit(item) {
    setEditingItem({ item, field: 'quantity', input: String(item.quantity) })
  }

  function confirmQuantityEdit() {
    const newQuantity = Number(editingItem.input)
    if (!Number.isInteger(newQuantity) || newQuantity < 1) {
      alert('Inserisci una quantità valida')
      return
    }
    updateQuantityMut.mutate({
      orderId:  order.id,
      itemId:   editingItem.item.id,
      quantity: newQuantity,
    })
  }

  function handleChangeUscita(itemId, newUscita) {
    updateItemMut.mutate({ orderId: order.id, itemId, data: { uscita: newUscita } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '8px 12px', fontSize: 12, fontWeight: 600,
        color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)', flexShrink: 0
      }}>
        Riepilogo ordine
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>

        {/* Sezioni per uscita */}
        {usciteKeys.map((uscitaNum, idx) => (
          <div key={uscitaNum} style={{ marginBottom: 8 }}>
            {/* Header uscita */}
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
              color: 'var(--color-text-secondary)',
              padding: '5px 0 3px',
              borderTop: idx > 0 ? '1px solid var(--color-border-tertiary)' : 'none',
              marginTop: idx > 0 ? 4 : 0,
            }}>
              USCITA {uscitaNum}
            </div>

            {itemsByUscita[uscitaNum].map(item => (
              <ItemRow
                key={item.id}
                item={item}
                isMutating={deleteItemMut.isPending || updateItemMut.isPending}
                onDelete={(e) => { e.stopPropagation(); deleteItemMut.mutate({ orderId: order.id, itemId: item.id }) }}
                onPriceEdit={() => openPriceEdit(item)}
                onQuantityEdit={() => openQuantityEdit(item)}
                onChangeUscita={(n) => handleChangeUscita(item.id, n)}
              />
            ))}
          </div>
        ))}

        {/* ANNULLATI */}
        {cancelled.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.06em', marginBottom: 4,
              color: 'var(--color-text-danger)',
              borderTop: usciteKeys.length > 0 ? '1px solid var(--color-border-tertiary)' : 'none',
              paddingTop: usciteKeys.length > 0 ? 5 : 0,
            }}>
              ANNULLATI — {cancelled.length}
            </div>
            {cancelled.map(item => (
              <ItemRow key={item.id} item={item} variant="cancelled" />
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            Ordine vuoto
          </div>
        )}
      </div>

      <div style={{
        padding: '10px 12px', borderTop: '1px solid var(--color-border-tertiary)',
        background: 'var(--color-background-secondary)',
        flexShrink: 0,
      }}>
        {/* Riga coperto — visibile solo se coperto_price > 0 */}
        {Number(order?.coperto_price ?? 0) > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              Coperto ×{order.covers} (€ {Number(order.coperto_price).toFixed(2)}/pers.)
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              &euro; {Number(order.coperto_total ?? 0).toFixed(2)}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Totale</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-info)' }}>
            &euro; {Number(order?.total ?? 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Modal modifica prezzo / quantità */}
      {editingItem && (() => {
        const isPriceField = editingItem.field === 'price'
        const confirmEdit  = isPriceField ? confirmPriceEdit : confirmQuantityEdit
        const editMut      = isPriceField ? updatePriceMut : updateQuantityMut
        const unitPrice    = isPriceField
          ? (parseFloat(editingItem.input) || 0)
          : Number(editingItem.item.total_price) / Number(editingItem.item.quantity)
        const quantity     = isPriceField
          ? editingItem.item.quantity
          : (parseInt(editingItem.input, 10) || 0)

        return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--color-background-primary)',
            borderRadius: 14, padding: 22, width: '100%', maxWidth: 320,
            border: '1px solid var(--color-border-tertiary)',
            boxShadow: '0 8px 32px rgba(0,0,0,.2)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {isPriceField ? 'Modifica prezzo' : 'Modifica quantità'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 18 }}>
              {editingItem.item.item_type === 'pizza'
                ? editingItem.item.pizza?.name
                : editingItem.item.item_type === 'wine'
                  ? editingItem.item.wine?.name
                  : editingItem.item.dish?.name}
              {isPriceField && editingItem.item.quantity > 1 && (
                <span style={{ marginLeft: 6, color: 'var(--color-text-tertiary)' }}>
                  × {editingItem.item.quantity}
                </span>
              )}
            </div>

            <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>
              {isPriceField ? 'Prezzo finale (€)' : 'Quantità'}
            </label>
            {isPriceField && (() => {
              const modsTotal = (editingItem.item.modifications ?? [])
                .reduce((s, m) => s + Number(m.price_change ?? 0), 0)
              if (modsTotal === 0) return null
              return (
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 6, marginTop: -2 }}>
                  Varianti incluse (€ {modsTotal.toFixed(2)} per unità)
                </div>
              )
            })()}
            <input
              type="number"
              min={isPriceField ? '0' : '1'}
              step={isPriceField ? '0.01' : '1'}
              value={editingItem.input}
              onChange={e => setEditingItem(prev => ({ ...prev, input: e.target.value }))}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', fontSize: 20, fontWeight: 700,
                borderRadius: 8, border: '2px solid var(--color-primary)',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                textAlign: 'right', boxSizing: 'border-box',
              }}
            />

            {(isPriceField ? editingItem.item.quantity > 1 : true) && (
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6, textAlign: 'right' }}>
                Totale riga: € {(unitPrice * quantity).toFixed(2)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setEditingItem(null)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13,
                  border: '1px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
                }}
              >Annulla</button>
              <button
                onClick={confirmEdit}
                disabled={editMut.isPending}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: 'var(--color-primary)', color: '#fff', border: 'none',
                  opacity: editMut.isPending ? 0.7 : 1,
                }}
              >
                {editMut.isPending ? 'Salvataggio...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

function ItemRow({ item, onDelete, onPriceEdit, onQuantityEdit, onChangeUscita, isMutating, variant }) {
  const name = item.item_type === 'pizza'
    ? item.pizza?.name
    : item.item_type === 'wine'
      ? item.wine?.name
      : item.dish?.name

  const isCancelled = variant === 'cancelled'
  const isPending   = item.status === 'pending'
  const isSent      = item.status === 'sent'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 6,
      padding: '7px 6px',
      borderBottom: '1px solid var(--color-border-tertiary)',
      borderRadius: 6, marginBottom: 2,
      background: isPending
        ? 'var(--color-background-info)'
        : isCancelled
          ? 'var(--color-background-danger)'
          : 'transparent',
      opacity: isCancelled ? 0.5 : 1,
    }}>
      {!isCancelled ? (
        <button
          onClick={onQuantityEdit}
          disabled={!onQuantityEdit}
          style={{
            fontSize: 12, minWidth: 18, fontWeight: 600,
            color: 'var(--color-text-info)',
            textDecoration: 'underline dotted',
            background: 'none', border: 'none', padding: 0,
            cursor: onQuantityEdit ? 'pointer' : 'default',
          }}
          title="Tocca per modificare la quantità"
        >&times;{item.quantity}</button>
      ) : (
        <span style={{
          fontSize: 12, minWidth: 18, fontWeight: 600,
          color: 'var(--color-text-danger)',
          textDecoration: 'line-through',
        }}>&times;{item.quantity}</span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          color: isCancelled ? 'var(--color-text-danger)' : 'var(--color-text-primary)',
          textDecoration: isCancelled ? 'line-through' : 'none',
        }}>{name}</div>

        {/* Badge stato */}
        {isSent && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3,
            background: 'var(--color-background-success)', color: 'var(--color-text-success)',
            marginTop: 2, display: 'inline-block',
          }}>inviato</span>
        )}

        {item.modifications?.map((m, i) => (
          <div key={i} style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            &rsaquo; {formatModDisplay(m)}
          </div>
        ))}
        {item.notes && (
          <div style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--color-text-tertiary)' }}>
            {item.notes}
          </div>
        )}

        {/* Selector uscita inline — solo su pending */}
        {isPending && onChangeUscita && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Uscita:</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => onChangeUscita(n)}
                style={{
                  width: 20, height: 20, borderRadius: 3,
                  fontSize: 10, fontWeight: (item.uscita ?? 1) === n ? 600 : 400,
                  border: '1px solid var(--color-border-secondary)',
                  background: (item.uscita ?? 1) === n
                    ? 'var(--color-background-info)'
                    : 'var(--color-background-secondary)',
                  color: (item.uscita ?? 1) === n
                    ? 'var(--color-text-info)'
                    : 'var(--color-text-secondary)',
                  cursor: 'pointer', padding: 0,
                }}
              >{n}</button>
            ))}
          </div>
        )}
      </div>

      {/* Prezzo — cliccabile per modifica (se non annullato) */}
      {!isCancelled && (
        <button
          onClick={onPriceEdit}
          disabled={!onPriceEdit}
          style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--color-text-info)',
            textDecoration: 'underline dotted',
            background: 'none', border: 'none', padding: '0 2px',
            cursor: onPriceEdit ? 'pointer' : 'default',
            flexShrink: 0,
          }}
          title="Tocca per modificare il prezzo"
        >
          &euro;&nbsp;{Number(item.total_price).toFixed(2)}
        </button>
      )}

      {isCancelled && (
        <span style={{
          fontSize: 11, fontWeight: 600, flexShrink: 0,
          color: 'var(--color-text-danger)',
          textDecoration: 'line-through', padding: '0 2px',
        }}>
          &euro;&nbsp;{Number(item.total_price).toFixed(2)}
        </span>
      )}

      {!isCancelled && onDelete && (
        <button
          onClick={onDelete}
          disabled={isMutating}
          style={{
            width: 32, height: 32, borderRadius: 6, flexShrink: 0,
            background: 'var(--color-background-danger)',
            color: 'var(--color-text-danger)',
            border: '1px solid var(--color-border-danger)',
            fontSize: 16, fontWeight: 700, cursor: 'pointer',
            opacity: isMutating ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >&times;</button>
      )}
    </div>
  )
}
