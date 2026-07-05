import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '../../api/endpoints/orders'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useOrderStore } from '../../store/useOrderStore'
import echo from '../../echo'
import MenuPanel from '../../components/tablet/MenuPanel'
import OrderSummary from '../../components/tablet/OrderSummary'
import ConfirmSendDialog from '../../components/tablet/ConfirmSendDialog'
import ReprintSectorDialog from '../../components/tablet/ReprintSectorDialog'
import PrintErrorToast from '../../components/tablet/PrintErrorToast'
import BottomNavBar from '../../components/tablet/BottomNavBar'
import { useModule } from '../../hooks/useModule'

export default function OrderScreen() {
  const { id } = useParams()   // table id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { closeTableMessage } = useSettingsStore()
  const { setOrderItems } = useOrderStore()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReprintSector, setShowReprintSector] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [printErrors, setPrintErrors] = useState([])
  const [coversInput, setCoversInput] = useState('')
  const [preContoOk, setPreContoOk] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const printingEnabled = useModule('printing')

  // Map<jobId, EchoChannel> — canali privati aperto dopo ogni send per ricevere
  // lo status asincrono dal job in coda. Cleanup all'unmount.
  const printChannelsRef = useRef(new Map())

  useEffect(() => {
    return () => {
      printChannelsRef.current.forEach((_, jobId) => {
        echo.leave(`print-jobs.${jobId}`)
      })
      printChannelsRef.current.clear()
    }
  }, [])

  // Info tavolo (numero, zona)
  const { data: table } = useQuery({
    queryKey: ['table', id],
    queryFn: () => ordersApi.getTable(id).then(r => r.data?.data ?? r.data),
  })

  // active_order è già incluso in TableResource — nessuna query extra necessaria
  const orderId = table?.active_order?.id
  const covers  = table?.active_order?.covers

  const { data: order, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.getOrder(orderId).then(r => r.data?.data ?? r.data),
    enabled: !!orderId,
  })

  // Sincronizza gli items dell'ordine nello store (per getMaxUscita nei configuratori)
  useEffect(() => {
    setOrderItems(order?.items ?? [])
  }, [order?.items])

  // Aggiornamenti real-time ordine: se un altro dispositivo invia la comanda,
  // refetch ricarica items e total senza che il cameriere debba aggiornare manualmente.
  useEffect(() => {
    if (!orderId) return
    const ch = echo.private(`orders.${orderId}`)
    ch.listen('.order.sent', () => refetch())
    return () => echo.leave(`orders.${orderId}`)
  }, [orderId])

  const updateCoversMut = useMutation({
    mutationFn: (n) => ordersApi.updateCovers(id, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['table', id] })
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['zones'] })
    },
  })

  const reprintMutation = useMutation({
    mutationFn: () => ordersApi.reprintSend(orderId, lastSend.id),
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la ristampa'),
  })

  const reprintJobMutation = useMutation({
    mutationFn: (jobId) => ordersApi.reprintPrintJob(jobId),
    onSuccess: () => setShowReprintSector(false),
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la ristampa del settore'),
  })

  const sendMutation = useMutation({
    mutationFn: (allSpicchi = false) => ordersApi.sendOrder(orderId, { all_spicchi: allSpicchi }),
    onSuccess: (res) => {
      setShowConfirm(false)
      refetch()
      qc.invalidateQueries({ queryKey: ['zones'] })
      qc.invalidateQueries({ queryKey: ['table', id] })

      // La stampa è asincrona (queue). Ci iscriviamo al canale privato di ogni
      // print job per ricevere lo status finale (done / failed) via WebSocket.
      const jobs = res.data.print_jobs ?? []
      jobs.forEach(job => {
        if (printChannelsRef.current.has(job.id)) return

        const ch = echo.private(`print-jobs.${job.id}`)
        ch.listen('.print.status', (data) => {
          if (data.status === 'failed') {
            setPrintErrors(prev =>
              prev.find(p => p.job_id === data.job_id)
                ? prev
                : [...prev, { job_id: data.job_id, print_type: data.print_type }]
            )
          }
          // Canale terminale (done o failed): chiudi la subscription
          if (data.status === 'done' || data.status === 'failed') {
            echo.leave(`print-jobs.${data.job_id}`)
            printChannelsRef.current.delete(data.job_id)
          }
        })

        printChannelsRef.current.set(job.id, ch)
      })
    },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante l\'invio'),
  })

  const preContoMut = useMutation({
    mutationFn: () => ordersApi.preContoOrder(orderId),
    onSuccess: (res) => {
      setPreContoOk(true)
      setTimeout(() => setPreContoOk(false), 3000)

      const jobId = res.data.job_id
      if (!jobId || printChannelsRef.current.has(jobId)) return
      const ch = echo.private(`print-jobs.${jobId}`)
      ch.listen('.print.status', (data) => {
        if (data.status === 'failed') {
          setPrintErrors(prev =>
            prev.find(p => p.job_id === data.job_id)
              ? prev
              : [...prev, { job_id: data.job_id, print_type: 'pre_conto' }]
          )
        }
        if (data.status === 'done' || data.status === 'failed') {
          echo.leave(`print-jobs.${jobId}`)
          printChannelsRef.current.delete(jobId)
        }
      })
      printChannelsRef.current.set(jobId, ch)
    },
    onError: (err) => alert(err.response?.data?.message ?? 'Errore durante la stampa del pre-conto'),
  })

  const handlePreContoPdf = async () => {
    setPdfLoading(true)
    try {
      const res = await ordersApi.preContoPdf(orderId)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch (err) {
      alert(err.response?.data?.message ?? 'Errore nella generazione del PDF pre-conto')
    } finally {
      setPdfLoading(false)
    }
  }

  const closeOrderMut = useMutation({
    mutationFn: (confirm = false) => ordersApi.closeOrder(orderId, confirm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      qc.invalidateQueries({ queryKey: ['table', id] })
      setShowCloseConfirm(false)
      navigate('/')
    },
    onError: (err) => {
      // M7: stampe fallite ⇒ conferma bloccante prima di eliminare i PDF di backup.
      if (err.response?.status === 409 && err.response?.data?.error_code === 'failed_prints_pending') {
        if (window.confirm(`${err.response.data.message}\n\nChiudere comunque il tavolo?`)) {
          closeOrderMut.mutate(true)
          return
        }
        setShowCloseConfirm(false)
        return
      }
      setShowCloseConfirm(false)
      alert(err.response?.data?.message ?? 'Errore durante la chiusura del tavolo')
    },
  })

  const pendingItems    = order?.items?.filter(i => i.status === 'pending') ?? []
  const hasPizzasPending = pendingItems.some(i => i.item_type === 'pizza')

  // Ultimo invio reale (send_number > 0), usato per la ristampa
  const lastSend = order?.sends
    ?.filter(s => s.send_number > 0)
    .sort((a, b) => b.send_number - a.send_number)[0] ?? null

  // Modalità ristampa: nessun pending E almeno un invio già effettuato
  const isRistampaMode = pendingItems.length === 0 && !!order?.first_sent_at && !!lastSend

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background-primary)' }}>
      {/* TopBar */}
      <div style={{
        padding: '8px 14px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <button onClick={() => navigate('/')} style={{
          fontSize: 18, background: 'none', border: 'none',
          color: 'var(--color-text-secondary)', padding: '0 4px'
        }}>←</button>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Tav {table?.number}{table?.suffix ? ` ${table.suffix}` : ''} — Ordine #{order?.order_number}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-info)' }}>
            € {Number(order?.total ?? 0).toFixed(2)}
          </span>
          <button onClick={() => setShowCloseConfirm(true)} style={{
            padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            background: 'var(--color-background-danger)', color: 'var(--color-text-danger)',
            border: '1px solid var(--color-border-danger)'
          }}>Chiudi tavolo</button>
        </div>
      </div>

      {/* Coperti */}
      <div style={{
        padding: '6px 14px', background: 'var(--color-background-secondary)',
        borderBottom: '1px solid var(--color-border-tertiary)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0
      }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 52 }}>Coperti:</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {[1,2,3,4,5,6,7,8].map(n => (
            <button key={n} onClick={() => updateCoversMut.mutate(n)} style={{
              width: 32, height: 32, borderRadius: 7, fontSize: 13, fontWeight: 500,
              border: '1px solid var(--color-border-secondary)',
              background: covers === n ? 'var(--color-background-info)' : 'var(--color-background-primary)',
              color: covers === n ? 'var(--color-text-info)' : 'var(--color-text-primary)',
            }}>{n}</button>
          ))}
          <input
            type="number" min="1" placeholder="…"
            value={coversInput}
            onChange={e => setCoversInput(e.target.value)}
            onBlur={() => { if (coversInput) { updateCoversMut.mutate(parseInt(coversInput)); setCoversInput('') } }}
            style={{
              width: 44, height: 32, borderRadius: 7, fontSize: 13, textAlign: 'center',
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-primary)', color: 'var(--color-text-primary)'
            }}
          />
        </div>
      </div>

      {/* Split 50/50 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '50%', borderRight: '1px solid var(--color-border-tertiary)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <MenuPanel orderId={orderId} onItemAdded={refetch} />
        </div>
        <div style={{ width: '50%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <OrderSummary order={order} onUpdate={refetch} />
        </div>
      </div>

      {/* Send bar */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid var(--color-border-tertiary)',
        background: 'var(--color-background-secondary)',
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          {pendingItems.length > 0 ? `${pendingItems.length} da inviare` : 'Nessun articolo pendente'}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Pre-conto — abilitato sempre, indipendentemente dall'invio in cucina/bar */}
          {printingEnabled && (
            <button
              disabled={preContoMut.isPending || preContoOk}
              onClick={() => preContoMut.mutate()}
              title="Stampa pre-conto alla cassa"
              style={{
                padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: preContoOk
                  ? 'var(--color-background-success)'
                  : 'var(--color-background-warning)',
                color: preContoOk
                  ? 'var(--color-text-success)'
                  : 'var(--color-text-warning)',
                border: `1px solid ${preContoOk
                  ? 'var(--color-border-success)'
                  : 'var(--color-border-warning)'}`,
                opacity: preContoMut.isPending ? 0.7 : 1,
                cursor: !preContoOk ? 'pointer' : 'not-allowed',
                transition: 'all .2s',
              }}
            >
              {preContoMut.isPending ? '...' : preContoOk ? '✓ Inviato' : 'Pre-conto'}
            </button>
          )}

          <button
            disabled={pdfLoading}
            onClick={handlePreContoPdf}
            title="Visualizza PDF pre-conto"
            style={{
              padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-background-info)',
              color: 'var(--color-text-info)',
              border: '1px solid var(--color-border-info)',
              opacity: pdfLoading ? 0.7 : 1,
              cursor: pdfLoading ? 'not-allowed' : 'pointer',
              transition: 'all .2s',
            }}
          >
            {pdfLoading ? '...' : 'PDF Pre-conto'}
          </button>

          {printingEnabled && order?.first_sent_at && lastSend && (
            <button
              onClick={() => setShowReprintSector(true)}
              title="Ristampa solo un settore (cassa, cucina, pizzeria o bar)"
              style={{
                padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-secondary)',
                cursor: 'pointer', transition: 'all .2s',
              }}
            >Ristampa</button>
          )}

          {printingEnabled && isRistampaMode ? (
            <button
              disabled={reprintMutation.isPending}
              onClick={() => reprintMutation.mutate()}
              style={{
                padding: '9px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: 'var(--color-background-warning)',
                color: 'var(--color-text-warning)',
                border: '2px solid var(--color-border-warning)',
                opacity: reprintMutation.isPending ? 0.7 : 1,
                transition: 'all .15s', cursor: 'pointer',
              }}
            >
              {reprintMutation.isPending ? 'Ristampa...' : 'Ristampa intera comanda'}
            </button>
          ) : (
            <button
              disabled={pendingItems.length === 0 || sendMutation.isPending}
              onClick={() => setShowConfirm(true)}
              style={{
                padding: '9px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                background: pendingItems.length > 0 ? 'var(--color-primary)' : 'var(--color-background-primary)',
                color: pendingItems.length > 0 ? '#fff' : 'var(--color-text-secondary)',
                border: `2px solid ${pendingItems.length > 0 ? 'var(--color-primary)' : 'var(--color-border-secondary)'}`,
                opacity: sendMutation.isPending ? 0.7 : 1,
                transition: 'all .15s', cursor: pendingItems.length > 0 ? 'pointer' : 'default',
              }}
            >
              {sendMutation.isPending ? 'Invio...' : 'Invia comanda'}
            </button>
          )}
        </div>
      </div>

      <BottomNavBar active="order" />

      {showConfirm && (
        <ConfirmSendDialog
          order={order}
          pendingCount={pendingItems.length}
          hasPizzas={hasPizzasPending}
          onConfirm={(allSpicchi) => sendMutation.mutate(allSpicchi)}
          onCancel={() => setShowConfirm(false)}
          isPending={sendMutation.isPending}
        />
      )}

      {showReprintSector && (
        <ReprintSectorDialog
          printJobs={lastSend?.print_jobs ?? []}
          isPending={reprintJobMutation.isPending}
          onConfirm={(jobId) => reprintJobMutation.mutate(jobId)}
          onCancel={() => setShowReprintSector(false)}
        />
      )}

      {/* Conferma chiusura tavolo */}
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

      {printingEnabled && printErrors.map(err => (
        <PrintErrorToast
          key={err.job_id}
          error={err}
          orderId={orderId}
          onDismiss={() => setPrintErrors(p => p.filter(e => e.job_id !== err.job_id))}
        />
      ))}
    </div>
  )
}
