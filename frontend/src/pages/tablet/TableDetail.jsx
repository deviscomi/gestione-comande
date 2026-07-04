import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '../../api/endpoints/orders'
import { useSettingsStore } from '../../store/useSettingsStore'
import BottomNavBar from '../../components/tablet/BottomNavBar'

const STATUS_LABEL = { libero: 'Libero', occupato: 'Occupato', in_corso: 'In corso' }
const STATUS_COLOR = {
  libero:   { bg: 'var(--color-background-primary)',  text: 'var(--color-text-tertiary)' },
  occupato: { bg: 'var(--color-background-warning)',  text: 'var(--color-text-warning)' },
  in_corso: { bg: 'var(--color-background-info)',     text: 'var(--color-text-info)' },
}

export default function TableDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { closeTableMessage } = useSettingsStore()
  const [coversInput, setCoversInput] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  // Info tavolo (numero, zona, stato)
  const { data: table } = useQuery({
    queryKey: ['table', id],
    queryFn: () => ordersApi.getTable(id).then(r => r.data?.data ?? r.data),
  })

  // active_order è già incluso in TableResource — nessuna query extra necessaria
  const order = table?.active_order ?? null

  const openOrderMut = useMutation({
    mutationFn: () => ordersApi.createOrder(parseInt(id)),
    onSuccess: async () => {
      // refetchQueries attende il completamento: quando navighiamo,
      // OrderScreen trova già table.active_order popolato
      await qc.refetchQueries({ queryKey: ['table', id] })
      navigate(`/tables/${id}/order`)
    },
    onError: (err) => {
      if (!err.response) {
        alert('Connessione al server assente: l\'apertura del tavolo verrà inviata automaticamente al ripristino della connessione.')
        return
      }
      alert(err.response?.data?.message ?? 'Errore durante l\'apertura del tavolo')
    },
  })

  const updateCoversMut = useMutation({
    mutationFn: (n) => ordersApi.updateCovers(id, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['table', id] })
      qc.invalidateQueries({ queryKey: ['zones'] })
    },
  })

  const closeOrderMut = useMutation({
    mutationFn: () => ordersApi.closeOrder(order?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['table', id] })
      qc.invalidateQueries({ queryKey: ['zones'] })
      setShowCloseConfirm(false)
      navigate('/')
    },
    onError: (err) => {
      setShowCloseConfirm(false)
      alert(err.response?.data?.message ?? 'Errore durante la chiusura del tavolo')
    },
  })

  // Stato KDS dell'ordine: avvisa se ci sono ancora portate in preparazione/attesa
  const { data: kdsStatus } = useQuery({
    queryKey: ['kds-status', order?.id],
    queryFn: () => ordersApi.getKdsStatus(order.id).then(r => r.data),
    enabled: showCloseConfirm && !!order?.id,
  })

  const c = STATUS_COLOR[table?.status] ?? STATUS_COLOR.libero

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background-primary)' }}>
      {/* TopBar */}
      <div style={{
        padding: '10px 14px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <button onClick={() => navigate('/')} style={{
          fontSize: 18, background: 'none', border: 'none', color: 'var(--color-text-secondary)', padding: 0
        }}>←</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          Tavolo {table?.number}{table?.suffix ? ` ${table.suffix}` : ''} — {table?.zone?.name}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 8,
          background: c.bg, color: c.text, border: '1px solid currentColor'
        }}>{STATUS_LABEL[table?.status]}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Coperti */}
        {order && (
          <div style={{
            marginBottom: 16, padding: 14, borderRadius: 10,
            background: 'var(--color-background-secondary)',
            border: '1px solid var(--color-border-tertiary)'
          }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Coperti</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <button key={n} onClick={() => updateCoversMut.mutate(n)} style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: 14, fontWeight: 500,
                  border: '1px solid var(--color-border-secondary)',
                  background: order.covers === n ? 'var(--color-background-info)' : 'var(--color-background-primary)',
                  color: order.covers === n ? 'var(--color-text-info)' : 'var(--color-text-primary)',
                }}>{n}</button>
              ))}
              <input
                type="number" min="1" placeholder="…"
                value={coversInput}
                onChange={e => setCoversInput(e.target.value)}
                onBlur={() => coversInput && updateCoversMut.mutate(parseInt(coversInput))}
                style={{
                  width: 48, height: 36, borderRadius: 8, fontSize: 13, textAlign: 'center',
                  border: '1px solid var(--color-border-secondary)',
                  background: 'var(--color-background-primary)', color: 'var(--color-text-primary)'
                }}
              />
            </div>
          </div>
        )}

        {/* Ordine attivo / Apri tavolo */}
        {order ? (
          <div style={{
            padding: 14, borderRadius: 10,
            background: 'var(--color-background-secondary)',
            border: '1px solid var(--color-border-tertiary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Ordine #{order.order_number}</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-info)', fontWeight: 600 }}>
                € {Number(order.total ?? 0).toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate(`/tables/${id}/order`)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--color-background-info)', color: 'var(--color-text-info)',
                border: '1px solid var(--color-border-info)'
              }}>Gestisci ordine</button>
              <button onClick={() => setShowCloseConfirm(true)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'var(--color-background-danger)', color: 'var(--color-text-danger)',
                border: '1px solid var(--color-border-danger)'
              }}>Chiudi tavolo</button>
            </div>
          </div>
        ) : (
          <button onClick={() => openOrderMut.mutate()} disabled={openOrderMut.isPending} style={{
            width: '100%', padding: 14, borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            opacity: openOrderMut.isPending ? 0.7 : 1
          }}>
            {openOrderMut.isPending ? 'Apertura...' : '+ Apri tavolo'}
          </button>
        )}
      </div>

      {/* Conferma chiusura */}
      {showCloseConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: 320, padding: 24, borderRadius: 12,
            background: 'var(--color-background-primary)',
            border: '1px solid var(--color-border-tertiary)'
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Chiudi tavolo</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              {closeTableMessage}
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
                background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)'
              }}>Annulla</button>
              <button onClick={() => closeOrderMut.mutate()} disabled={closeOrderMut.isPending} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--color-background-danger)', color: 'var(--color-text-danger)',
                border: '1px solid var(--color-border-danger)',
                opacity: closeOrderMut.isPending ? 0.7 : 1
              }}>{closeOrderMut.isPending ? 'Chiusura...' : 'Conferma chiusura'}</button>
            </div>
          </div>
        </div>
      )}

      <BottomNavBar active="tables" />
    </div>
  )
}
