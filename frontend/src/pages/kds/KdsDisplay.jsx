import { useEffect, useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/axios'
import echo from '../../echo'
import { useKdsStore } from '../../store/useKdsStore'
import KdsComanda from './KdsComanda'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch (_) {
    // AudioContext non disponibile (es. tab in background)
  }
}

// Numero di uscite pizzeria autonome (bar spento): pending e già "chiamate" (autosbloccate).
function countAutoPizza(comande) {
  return comande.reduce(
    (n, c) => n + c.uscite.filter((u) => u.status === 'pending' && u.called).length,
    0
  )
}

function LiveClock() {
  const [now, setNow] = useState(() =>
    new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  )
  useEffect(() => {
    const id = setInterval(
      () => setNow(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })),
      10000
    )
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 21, fontWeight: 600, color: 'var(--kds-text-secondary)' }}>
      {now}
    </span>
  )
}

const DEPT_ACCENT = {
  cucina:   'var(--kds-cucina-accent)',
  pizzeria: 'var(--kds-pizzeria-accent)',
  bar:      'var(--kds-bar-accent)',
}

const DEPT_LABEL = {
  cucina:   'CUCINA',
  pizzeria: 'PIZZERIA',
  bar:      'BAR',
}

export default function KdsDisplay({ department }) {
  const {
    setComande, setDepartment,
    updateUscitaStatus, updateOtherDeptStatus, markComplete, markCalled,
    nextPage, prevPage, visibleComande, hiddenCount, currentPage, totalPages, comande,
    viewOffset,   // forza re-render quando la pagina cambia
  } = useKdsStore()

  // Stato operativo del bar (dal backend, via campo bar_open della coda): determina
  // chi suona all'arrivo di una comanda quando il bar è spento.
  const barOpenRef = useRef(true)
  // Conteggio uscite pizzeria autonome (pending && called): suona solo quando ne compaiono di nuove.
  const prevAutoPizzaRef = useRef(0)

  const refetchQueue = useCallback(async () => {
    const res = await api.get(`/kds/queue?department=${department}`)
    setComande(res.data)
    if (res.data.length) barOpenRef.current = res.data[0].bar_open ?? true
    return res.data
  }, [department, setComande])

  const { isLoading, data: queueData } = useQuery({
    queryKey: ['kds-queue', department],
    queryFn: () => api.get(`/kds/queue?department=${department}`).then((r) => r.data),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (queueData) {
      setComande(queueData)
      setDepartment(department)
      if (queueData.length) barOpenRef.current = queueData[0].bar_open ?? true
      prevAutoPizzaRef.current = countAutoPizza(queueData)
    }
  }, [queueData, department, setComande, setDepartment])

  useEffect(() => {
    setDepartment(department)
    const ch = echo.channel('kds-updates')

    ch.listen('.kds.update', async (e) => {
      if (e.eventType === 'new_order') {
        const data = await refetchQueue()
        // Bar acceso → coordinatore è il bar (suona solo lui; cucina/pizzeria attendono la chiamata).
        // Bar spento → coordinatore è la cucina; la pizzeria autonoma suona quando arriva una nuova uscita.
        if (barOpenRef.current) {
          if (department === 'bar') playBeep()
        } else if (department === 'cucina') {
          playBeep()
        } else if (department === 'pizzeria') {
          const autoCount = countAutoPizza(data)
          if (autoCount > prevAutoPizzaRef.current) playBeep()
          prevAutoPizzaRef.current = autoCount
        }
      } else if (e.eventType === 'order_update') {
        const data = await refetchQueue()
        prevAutoPizzaRef.current = countAutoPizza(data)
      } else if (e.eventType === 'status_update') {
        const p = e.payload
        if (p.department === department) {
          updateUscitaStatus(p.order_id, p.kds_status_id, p.status, p.status_updated_at)
        } else {
          updateOtherDeptStatus(p.order_id, p.uscita, p.department, p.status)
        }
      } else if (e.eventType === 'call') {
        // Il bar ha chiamato un reparto: toglie l'overlay IN ATTESA e suona sul display chiamato.
        const p = e.payload
        markCalled(p.order_id, p.kds_status_id)
        if (p.department === department) playBeep()
      } else if (e.eventType === 'order_complete') {
        markComplete(e.payload.order_id, e.payload.completed_at)
      }
    })

    return () => {
      ch.stopListening('.kds.update')
      echo.leave('kds-updates')
    }
  }, [department]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible      = visibleComande()
  const hidden       = hiddenCount()
  const page         = currentPage()
  const pages        = totalPages()
  const pendingCount = comande.reduce(
    (sum, c) => sum + c.uscite.filter((u) => u.status === 'pending').length,
    0
  )
  const accentColor  = DEPT_ACCENT[department]
  const deptLabel     = DEPT_LABEL[department]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--kds-bg)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'var(--kds-surface)',
        borderBottom: '1px solid var(--kds-border)',
        flexShrink: 0,
      }}>
        {/* Sinistra: nome reparto + badge in attesa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: accentColor,
          }}>
            {deptLabel}
          </span>
          {pendingCount > 0 && (
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#fff',
              background: 'var(--kds-in-corso-accent)',
              borderRadius: 999,
              padding: '4px 12px',
              lineHeight: 1,
            }}>
              {pendingCount} in attesa
            </span>
          )}
          {hidden > 0 && (
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--kds-in-corso-accent)',
              border: '1px solid var(--kds-in-corso-accent)',
              borderRadius: 999,
              padding: '4px 12px',
              lineHeight: 1,
            }}>
              +{hidden}
            </span>
          )}
        </div>

        {/* Destra: orologio */}
        <LiveClock />
      </div>

      {/* ── Area card ── */}
      <div style={{
        flex: 1,
        padding: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        alignContent: 'start',
      }}>
        {isLoading && (
          <div style={{
            gridColumn: '1/-1', textAlign: 'center', padding: 60,
            color: 'var(--kds-text-muted)', fontSize: 14, letterSpacing: '0.05em',
          }}>
            CARICAMENTO...
          </div>
        )}
        {!isLoading && visible.length === 0 && (
          <div style={{
            gridColumn: '1/-1', textAlign: 'center', padding: 80,
            color: 'var(--kds-text-muted)', fontSize: 14, letterSpacing: '0.1em',
          }}>
            NESSUNA COMANDA IN CODA
          </div>
        )}
        {visible.map((comanda) => (
          <KdsComanda key={comanda.order_id} comanda={comanda} department={department} />
        ))}
      </div>

      {/* ── Footer navigazione ── */}
      {pages > 1 && (
        <div style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: 'var(--kds-surface)',
          borderTop: '1px solid var(--kds-border)',
          flexShrink: 0,
        }}>
          <button
            onClick={prevPage}
            disabled={page <= 1}
            style={navBtnStyle(page <= 1)}
          >
            ◀ Prec.
          </button>
          <span style={{
            fontSize: 13,
            color: 'var(--kds-text-secondary)',
            minWidth: 70,
            textAlign: 'center',
          }}>
            pag {page} / {pages}
          </span>
          <button
            onClick={nextPage}
            disabled={page >= pages}
            style={navBtnStyle(page >= pages)}
          >
            Succ. ▶
          </button>
        </div>
      )}
    </div>
  )
}

function navBtnStyle(disabled) {
  return {
    background: 'transparent',
    border: 'none',
    color: disabled ? 'var(--kds-text-muted)' : 'var(--kds-text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    padding: '8px 16px',
    cursor: disabled ? 'default' : 'pointer',
  }
}
