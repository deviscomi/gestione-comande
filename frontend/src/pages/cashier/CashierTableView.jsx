import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cashierApi } from '../../api/endpoints/cashier'
import { ordersApi } from '../../api/endpoints/orders'
import { useCashierSelectionStore } from '../../store/useCashierSelectionStore'
import { useModule } from '../../hooks/useModule'
import echo from '../../echo'

export default function CashierTableView() {
  const { id } = useParams()   // order id
  const orderId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editingItem, setEditingItem] = useState(null)   // { item, priceInput }
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [fiscalFailure, setFiscalFailure] = useState(null) // { paymentId, message }
  const [skipNote, setSkipNote] = useState('')

  const { selection, selectFull, setQuantity, clear, getSubtotal, getAllocations } = useCashierSelectionStore()
  const fiscalEnabled = useModule('fiscal')

  const { data: status, refetch } = useQuery({
    queryKey: ['cashier-payment-status', orderId],
    queryFn: () => cashierApi.getPaymentStatus(orderId).then(r => r.data),
    enabled: !!orderId,
  })

  // Stato KDS dell'ordine: avvisa se ci sono ancora portate in preparazione/attesa
  const { data: kdsStatus } = useQuery({
    queryKey: ['kds-status', orderId],
    queryFn: () => ordersApi.getKdsStatus(orderId).then(r => r.data),
    enabled: showCloseConfirm && !!orderId,
  })

  // Cambio tavolo: azzera la selezione precedente
  useEffect(() => { clear() }, [orderId])

  // Sincronizzazione real-time tra dispositivi: un altro cassiere registra un pagamento
  useEffect(() => {
    if (!orderId) return
    const ch = echo.private(`orders.${orderId}`)
    ch.listen('.order.payment-registered', () => refetch())
    return () => echo.leave(`orders.${orderId}`)
  }, [orderId])

  const payMut = useMutation({
    mutationFn: (emitFiscal = true) => cashierApi.storePayment(orderId, getAllocations(), emitFiscal),
    onSuccess: (res) => {
      clear()
      refetch()
      qc.invalidateQueries({ queryKey: ['cashier-orders'] })

      const receipt = res.data?.fiscal_receipt
      if (receipt && receipt.fiscal_status === 'failed') {
        setFiscalFailure({ paymentId: receipt.order_payment_id, message: receipt.fiscal_error_message ?? 'Emissione scontrino fiscale fallita' })
      }
    },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la registrazione del pagamento'),
  })

  const retryFiscalMut = useMutation({
    mutationFn: (paymentId) => cashierApi.retryFiscalReceipt(paymentId),
    onSuccess: (res, paymentId) => {
      const receipt = res.data
      if (receipt.fiscal_status === 'issued') {
        setFiscalFailure(null)
      } else {
        setFiscalFailure({ paymentId, message: receipt.fiscal_error_message ?? 'Emissione scontrino fiscale fallita' })
      }
    },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante il nuovo tentativo'),
  })

  const skipFiscalMut = useMutation({
    mutationFn: ({ paymentId, note }) => cashierApi.skipFiscalReceipt(paymentId, note),
    onSuccess: () => { setFiscalFailure(null); setSkipNote('') },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la conferma'),
  })

  const updatePriceMut = useMutation({
    mutationFn: ({ itemId, final_unit_price }) => ordersApi.updateOrderItem(orderId, itemId, { final_unit_price }),
    onSuccess: () => { setEditingItem(null); refetch() },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la modifica del prezzo'),
  })

  const closeOrderMut = useMutation({
    mutationFn: () => ordersApi.closeOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashier-orders'] })
      navigate('/cassa')
    },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la chiusura del tavolo'),
  })

  if (!status) {
    return <div style={{ padding: 24, color: 'var(--color-text-tertiary)' }}>Caricamento...</div>
  }

  const subtotal = getSubtotal()
  const hasSelection = Object.keys(selection).length > 0
  const isSettled = status.is_settled

  function openPriceEdit(item) {
    // Si edita il prezzo finale per unità (varianti incluse): item.unit_price è già l'effective.
    setEditingItem({ item, priceInput: String(Number(item.unit_price).toFixed(2)) })
  }

  function confirmPriceEdit() {
    const newPrice = parseFloat(editingItem.priceInput)
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Inserisci un prezzo valido')
      return
    }
    updatePriceMut.mutate({ itemId: editingItem.item.id, final_unit_price: newPrice })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background-primary)' }}>
      <div style={{
        padding: '10px 16px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button onClick={() => navigate('/cassa')} style={{
          fontSize: 18, background: 'none', border: 'none', color: 'var(--color-text-secondary)', padding: '0 4px',
        }}>&larr;</button>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Ordine #{status.order_number}</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--color-text-info)' }}>
          Residuo: &euro; {Number(status.residual_total).toFixed(2)}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {status.items.map(item => (
          <PaymentRow
            key={item.id}
            row={item}
            selectionKey={`item-${item.id}`}
            selected={selection[`item-${item.id}`]}
            onSelectFull={() => selectFull(`item-${item.id}`, {
              type: 'item', orderItemId: item.id, quantity: item.residual_qty, unitPrice: item.unit_price,
            })}
            onAdjust={(delta) => {
              const current = selection[`item-${item.id}`]?.quantity ?? 0
              setQuantity(`item-${item.id}`, current + delta, {
                type: 'item', orderItemId: item.id, unitPrice: item.unit_price, maxQty: item.residual_qty,
              })
            }}
            onPriceEdit={() => openPriceEdit(item)}
          />
        ))}

        {status.coperto.total > 0 && (
          <PaymentRow
            key="coperto"
            row={{
              name: `Coperto x${status.coperto.total}`,
              quantity: status.coperto.total,
              unit_price: status.coperto.price,
              paid_qty: status.coperto.paid,
              residual_qty: status.coperto.residual,
            }}
            selectionKey="coperto"
            selected={selection['coperto']}
            onSelectFull={() => selectFull('coperto', {
              type: 'coperto', orderItemId: null, quantity: status.coperto.residual, unitPrice: status.coperto.price,
            })}
            onAdjust={(delta) => {
              const current = selection['coperto']?.quantity ?? 0
              setQuantity('coperto', current + delta, {
                type: 'coperto', orderItemId: null, unitPrice: status.coperto.price, maxQty: status.coperto.residual,
              })
            }}
          />
        )}
      </div>

      {/* Barra inferiore: selezione attiva oppure stato saldato */}
      {!isSettled ? (
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--color-border-tertiary)',
          background: 'var(--color-background-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Subtotale selezione</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              &euro; {subtotal.toFixed(2)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* "Incassa" senza emissione fiscale: stampa solo lo scontrino non fiscale.
                Sempre visibile (quando il fiscale è attivo è l'alternativa manuale;
                quando è disattivo è l'unico flusso possibile). */}
            <button
              disabled={!hasSelection || payMut.isPending}
              onClick={() => payMut.mutate(false)}
              style={{
                padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: 'var(--color-background-primary)',
                color: hasSelection ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                border: `2px solid ${hasSelection ? 'var(--color-primary)' : 'var(--color-border-secondary)'}`,
                opacity: payMut.isPending ? 0.7 : 1,
                cursor: hasSelection ? 'pointer' : 'default',
              }}
            >
              {payMut.isPending && payMut.variables === false ? 'Incasso in corso...' : 'Incassa'}
            </button>

            {fiscalEnabled && (
              <button
                disabled={!hasSelection || payMut.isPending}
                onClick={() => payMut.mutate(true)}
                style={{
                  padding: '12px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: hasSelection ? 'var(--color-primary)' : 'var(--color-background-primary)',
                  color: hasSelection ? '#fff' : 'var(--color-text-tertiary)',
                  border: `2px solid ${hasSelection ? 'var(--color-primary)' : 'var(--color-border-secondary)'}`,
                  opacity: payMut.isPending ? 0.7 : 1,
                  cursor: hasSelection ? 'pointer' : 'default',
                }}
              >
                {payMut.isPending && payMut.variables === true ? 'Emissione scontrino fiscale...' : 'Incassa ed emetti scontrino fiscale'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--color-border-success)',
          background: 'var(--color-background-success)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-success)' }}>
            &#10003; Tavolo saldato
          </span>
          <button
            onClick={() => setShowCloseConfirm(true)}
            style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'var(--color-text-success)', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Chiudi tavolo
          </button>
        </div>
      )}

      {/* Spinner bloccante durante l'emissione dello scontrino fiscale */}
      {payMut.isPending && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            padding: '20px 28px', borderRadius: 12, background: 'var(--color-background-primary)',
            border: '1px solid var(--color-border-tertiary)', fontSize: 14, fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>
            {payMut.variables === false ? 'Incasso in corso...' : 'Emissione scontrino fiscale in corso...'}
          </div>
        </div>
      )}

      {/* Banner bloccante: emissione scontrino fiscale fallita */}
      {fiscalFailure && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            width: '100%', maxWidth: 380, padding: 22, borderRadius: 14,
            background: 'var(--color-background-primary)', border: '1px solid var(--color-border-danger)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-danger)', marginBottom: 6 }}>
              Emissione scontrino fiscale fallita
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              {fiscalFailure.message}
            </div>

            <button
              onClick={() => retryFiscalMut.mutate(fiscalFailure.paymentId)}
              disabled={retryFiscalMut.isPending}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'var(--color-primary)', color: '#fff', border: 'none', marginBottom: 8,
                opacity: retryFiscalMut.isPending ? 0.7 : 1,
              }}
            >{retryFiscalMut.isPending ? 'Nuovo tentativo...' : 'Riprova'}</button>

            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Nota obbligatoria per procedere senza scontrino fiscale
            </div>
            <input
              value={skipNote}
              onChange={e => setSkipNote(e.target.value)}
              placeholder="Es. RT non disponibile, autorizzato da..."
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, marginBottom: 10,
                border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => {
                if (skipNote.trim().length < 3) { alert('Inserisci una nota di almeno 3 caratteri'); return }
                if (!confirm('Confermi di voler procedere senza scontrino fiscale? L\'operazione sarà registrata.')) return
                skipFiscalMut.mutate({ paymentId: fiscalFailure.paymentId, note: skipNote.trim() })
              }}
              disabled={skipFiscalMut.isPending}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: '1px solid var(--color-border-danger)', background: 'transparent',
                color: 'var(--color-text-danger)', opacity: skipFiscalMut.isPending ? 0.7 : 1,
              }}
            >Procedi senza scontrino fiscale</button>
          </div>
        </div>
      )}

      {/* Modal modifica prezzo */}
      {editingItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'var(--color-background-primary)', borderRadius: 14, padding: 22,
            width: '100%', maxWidth: 320, border: '1px solid var(--color-border-tertiary)',
            boxShadow: '0 8px 32px rgba(0,0,0,.2)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Modifica prezzo</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 18 }}>
              {editingItem.item.name}
            </div>
            {editingItem.item.base_unit_price != null
              && Number(editingItem.item.unit_price) !== Number(editingItem.item.base_unit_price) && (
              <div style={{
                fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12, marginTop: -10,
              }}>
                Prezzo finale per unità, varianti incluse (&euro; {(Number(editingItem.item.unit_price) - Number(editingItem.item.base_unit_price)).toFixed(2)} di varianti).
              </div>
            )}
            <input
              type="number" min="0" step="0.01"
              value={editingItem.priceInput}
              onChange={e => setEditingItem(prev => ({ ...prev, priceInput: e.target.value }))}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', fontSize: 20, fontWeight: 700, borderRadius: 8,
                border: '2px solid var(--color-primary)', background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)', textAlign: 'right', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setEditingItem(null)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
              }}>Annulla</button>
              <button onClick={confirmPriceEdit} disabled={updatePriceMut.isPending} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'var(--color-primary)', color: '#fff', border: 'none',
                opacity: updatePriceMut.isPending ? 0.7 : 1,
              }}>{updatePriceMut.isPending ? 'Salvataggio...' : 'Conferma'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Conferma chiusura tavolo */}
      {showCloseConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 320, padding: 24, borderRadius: 12, background: 'var(--color-background-primary)',
            border: '1px solid var(--color-border-tertiary)',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Chiudi tavolo</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              Il conto è saldato. Confermi la chiusura del tavolo?
            </p>
            {kdsStatus?.in_preparazione && (
              <div style={{
                marginBottom: 16, padding: 12, borderRadius: 8, fontSize: 13,
                background: 'var(--color-background-warning)', color: 'var(--color-text-warning)',
                border: '1px solid var(--color-border-warning)'
              }}>
                ⚠️ Questa comanda ha ancora {kdsStatus.count} portate in preparazione o in attesa nei monitor di cucina/pizzeria/bar. Chiudendo il tavolo verranno rimosse.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowCloseConfirm(false)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
              }}>Annulla</button>
              <button onClick={() => closeOrderMut.mutate()} disabled={closeOrderMut.isPending} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--color-primary)', color: '#fff', border: 'none',
                opacity: closeOrderMut.isPending ? 0.7 : 1,
              }}>{closeOrderMut.isPending ? 'Chiusura...' : 'Conferma chiusura'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentRow({ row, selectionKey, selected, onSelectFull, onAdjust, onPriceEdit }) {
  const selectedQty = selected?.quantity ?? 0
  const isPaid       = row.residual_qty === 0
  const isSelected   = selectedQty > 0
  const isPartial    = !isPaid && !isSelected && row.paid_qty > 0

  const colors = isPaid
    ? { bg: 'var(--color-background-success)', text: 'var(--color-text-success)', border: 'var(--color-border-success)' }
    : isSelected
      ? { bg: 'var(--color-background-info)', text: 'var(--color-text-info)', border: 'var(--color-border-info)' }
      : isPartial
        ? { bg: 'var(--color-background-warning)', text: 'var(--color-text-warning)', border: 'var(--color-border-warning)' }
        : { bg: 'var(--color-background-secondary)', text: 'var(--color-text-primary)', border: 'var(--color-border-tertiary)' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg,
      marginBottom: 6,
    }}>
      <button
        onClick={onSelectFull}
        disabled={isPaid}
        style={{
          flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0,
          cursor: isPaid ? 'default' : 'pointer',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{row.name}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
          Tot {row.quantity} &middot; Pagati {row.paid_qty} &middot; Residuo {row.residual_qty}
        </div>
      </button>

      {!isPaid && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => onAdjust(-1)} disabled={selectedQty <= 0} style={{
            width: 26, height: 26, borderRadius: 6, border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
            fontSize: 14, fontWeight: 700, cursor: selectedQty > 0 ? 'pointer' : 'default',
            opacity: selectedQty > 0 ? 1 : 0.4,
          }}>&minus;</button>
          <span style={{
            minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: 700, color: colors.text,
          }}>{selectedQty}</span>
          <button onClick={() => onAdjust(1)} disabled={selectedQty >= row.residual_qty} style={{
            width: 26, height: 26, borderRadius: 6, border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
            fontSize: 14, fontWeight: 700, cursor: selectedQty < row.residual_qty ? 'pointer' : 'default',
            opacity: selectedQty < row.residual_qty ? 1 : 0.4,
          }}>+</button>
        </div>
      )}

      {onPriceEdit && (
        <button onClick={onPriceEdit} style={{
          fontSize: 12, fontWeight: 600, color: 'var(--color-text-info)',
          textDecoration: 'underline dotted', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          &euro;&nbsp;{Number(row.unit_price).toFixed(2)}
        </button>
      )}
      {!onPriceEdit && (
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
          &euro;&nbsp;{Number(row.unit_price).toFixed(2)}
        </span>
      )}
    </div>
  )
}
