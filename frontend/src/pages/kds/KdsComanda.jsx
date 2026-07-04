import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'
import { useKdsStore } from '../../store/useKdsStore'
import { describeMod } from '../../utils/modifications'

const REMOVE_DELAY_MS = 3 * 60 * 1000

// Colore dell'etichetta per categoria di variante (senza/aggiunta/poco/abbondante).
const VAR_COLOR = {
  remove: 'var(--kds-var-remove)',
  add:    'var(--kds-var-add)',
  less:   'var(--kds-var-less)',
  more:   'var(--kds-var-more)',
  option: 'var(--kds-text-secondary)',
}

// Riga di variante condivisa: etichetta colorata in maiuscolo + testo ingrediente.
// Usata identica nel blocco articoli principali e nel blocco pizze (companion).
function ModLine({ mod, size = 12 }) {
  const { category, label, text } = describeMod(mod)
  const color = VAR_COLOR[category] ?? 'var(--kds-text-secondary)'
  return (
    <div style={{ fontSize: size, color, lineHeight: 1.4 }}>
      ·{' '}
      {label && <span style={{ fontWeight: 700 }}>{label} </span>}
      <span style={{ color: category === 'option' ? 'var(--kds-text-secondary)' : 'var(--kds-text-primary)' }}>{text}</span>
    </div>
  )
}

const DEPT_ACCENT = {
  cucina:   'var(--kds-cucina-accent)',
  pizzeria: 'var(--kds-pizzeria-accent)',
  bar:      'var(--kds-bar-accent)',
}

const DEPT_LABEL = {
  cucina:   'Cucina',
  pizzeria: 'Pizzeria',
  bar:      'Bar',
}

// Icona/colore/etichetta per lo stato di un reparto (pending/in_corso/pronto).
function deptStatusMeta(status) {
  if (status === 'pronto') return { icon: '✓', label: 'pronta', color: 'var(--kds-pronto-accent)' }
  if (status === 'in_corso') return { icon: '🔥', label: 'al lavoro', color: 'var(--kds-in-corso-accent)' }
  return { icon: '⏳', label: 'in attesa', color: 'var(--kds-attesa-accent)' }
}

function elapsed(sentAt) {
  const diff = Math.floor((Date.now() - new Date(sentAt).getTime()) / 1000)
  const m = Math.floor(diff / 60)
  return m > 0 ? `${m}m` : '<1m'
}

function useElapsed(sentAt) {
  const [label, setLabel] = useState(() => elapsed(sentAt))
  useEffect(() => {
    const id = setInterval(() => setLabel(elapsed(sentAt)), 10000)
    return () => clearInterval(id)
  }, [sentAt])
  return label
}

function Countdown({ fromTs, onExpire }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, REMOVE_DELAY_MS - (Date.now() - fromTs)))
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 500)
        if (next === 0) { clearInterval(id); onExpire() }
        return next
      })
    }, 500)
    return () => clearInterval(id)
  }, [fromTs, onExpire])

  const totalSec = Math.ceil(remaining / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {m}:{String(s).padStart(2, '0')}
    </span>
  )
}

function UscitaBlock({ uscita, department, onStatusUpdate, onCall }) {
  const [confirm, setConfirm] = useState(false)
  const [updating, setUpdating] = useState(false)
  const accentColor = DEPT_ACCENT[department]
  const otherDepartments = uscita.other_departments ?? []
  const isBar = department === 'bar'
  const isPronto = uscita.status === 'pronto'
  const isReadOnly = uscita.read_only || uscita.kds_status_id == null
  // Cucina/pizzeria: l'uscita è "in attesa" finché il bar non la chiama → overlay + niente pulsanti.
  const isWaiting = !isReadOnly && !isBar && uscita.status === 'pending' && !uscita.called
  const callTargets = uscita.call_targets ?? []
  // Bar: stati di tutte le parti dell'uscita (voce bar propria se presente + reparti chiamati).
  const barParts = [
    ...(isReadOnly ? [] : [uscita.status]),
    ...callTargets.map((t) => t.status),
  ]
  const allPartsPronto = barParts.length > 0 && barParts.every((s) => s === 'pronto')
  // Bar: ANDATA quando tutte le parti sono pronte. Cucina/pizzeria: invariato.
  const showAndata = isBar ? allPartsPronto : (!isReadOnly && isPronto)

  const handleStatusUpdate = async (newStatus) => {
    if (updating) return
    setUpdating(true)
    try {
      await onStatusUpdate(uscita.kds_status_id, newStatus)
    } finally {
      setUpdating(false)
      setConfirm(false)
    }
  }

  const borderColor = isReadOnly
    ? 'var(--kds-pizzeria-accent)'
    : uscita.status === 'pronto'   ? 'var(--kds-pronto-accent)'   :
      uscita.status === 'in_corso' ? 'var(--kds-in-corso-accent)' :
                                      'var(--kds-pending-accent)'

  return (
    <div style={{
      position: 'relative',
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: 4,
      marginBottom: 10,
      overflow: 'hidden',
      background: 'var(--kds-surface-alt)',
    }}>
      {showAndata && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '0.1em' }}>
            ANDATA ✓
          </span>
        </div>
      )}

      {isWaiting && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--kds-attesa-accent)', letterSpacing: '0.1em' }}>
            ⏳ IN ATTESA
          </span>
        </div>
      )}

      <div style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: accentColor,
            border: `1px solid ${accentColor}`,
            borderRadius: 4,
            padding: '2px 8px',
          }}>
            U{uscita.uscita}
          </span>
          <div style={{ fontSize: 11, display: 'flex', gap: 8 }}>
            {!isBar && otherDepartments.filter((od) => od.status).map((od) => {
              const meta = deptStatusMeta(od.status)
              return (
                <span key={od.department} style={{ color: meta.color, fontWeight: 600 }}>
                  {meta.icon} {DEPT_LABEL[od.department]} {meta.label}
                </span>
              )
            })}
          </div>
        </div>

        {uscita.items.map((item) => {
          const itemStyle = item.cancelled
            ? { textDecoration: 'line-through', color: 'var(--kds-alert)' }
            : item.is_addition
              ? { color: 'var(--kds-alert)' }
              : {}
          return (
            <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 6, lineHeight: 1.4 }}>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: item.cancelled || item.is_addition ? 'var(--kds-alert)' : accentColor,
                minWidth: 28, flexShrink: 0,
                ...itemStyle,
              }}>
                {item.quantity}×
              </span>
              <div style={itemStyle}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{item.name}</div>
                {item.notes && (
                  <div style={{ fontSize: 12, color: 'var(--kds-text-secondary)' }}>· {item.notes}</div>
                )}
                {item.modifications?.map((m, i) => (
                  <ModLine key={i} mod={m} size={12} />
                ))}
              </div>
            </div>
          )
        })}

        {!isBar && uscita.companion_items?.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--kds-border)',
            paddingTop: 6,
            marginTop: 4,
          }}>
            {isReadOnly && (
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--kds-text-muted)', marginBottom: 4,
              }}>
                PIZZE / DA PREPARARE
              </div>
            )}
            {uscita.companion_items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, lineHeight: 1.4 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--kds-text-secondary)',
                  minWidth: 28, flexShrink: 0,
                }}>
                  {item.quantity}×
                </span>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--kds-text-secondary)' }}>{item.name}</span>
                  {item.notes && (
                    <div style={{ fontSize: 11, color: 'var(--kds-text-muted)' }}>· {item.notes}</div>
                  )}
                  {item.modifications?.map((m, i2) => (
                    <ModLine key={i2} mod={m} size={11} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {callTargets.length > 0 && (
          <BarCallTargets targets={callTargets} onCall={onCall} />
        )}

        {!isReadOnly && !isWaiting && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
            {!confirm ? (
              <>
                <button
                  onClick={() => handleStatusUpdate('in_corso')}
                  disabled={updating || uscita.status === 'in_corso' || uscita.status === 'pronto'}
                  style={btnInCorso(updating || uscita.status === 'in_corso' || uscita.status === 'pronto')}
                >
                  IN CORSO
                </button>
                <button
                  onClick={() => setConfirm(true)}
                  disabled={updating || uscita.status === 'pronto'}
                  style={btnPronta(updating || uscita.status === 'pronto')}
                >
                  PRONTA ✓
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 11, color: 'var(--kds-text-secondary)' }}>Conferma?</span>
                <button onClick={() => setConfirm(false)} style={btnNeutral()}>No</button>
                <button onClick={() => handleStatusUpdate('pronto')} style={btnPronta(false)}>Sì ✓</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function KdsComanda({ comanda, department }) {
  const { removeComanda, updateUscitaStatus, markCalled } = useKdsStore()

  const [isNew, setIsNew] = useState(true)
  const removeTimerRef     = useRef(null)

  const timeLabel = useElapsed(comanda.sent_at)

  useEffect(() => {
    const id = setTimeout(() => setIsNew(false), 2500)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (comanda.completed_at) {
      const readyTs   = new Date(comanda.completed_at).getTime()
      const remaining = Math.max(0, REMOVE_DELAY_MS - (Date.now() - readyTs))
      removeTimerRef.current = setTimeout(() => removeComanda(comanda.order_id), remaining)
    }
    return () => { if (removeTimerRef.current) clearTimeout(removeTimerRef.current) }
  }, [comanda.completed_at, comanda.order_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusUpdate = async (kdsStatusId, newStatus) => {
    try {
      const res = await api.patch(`/kds/statuses/${kdsStatusId}`, { status: newStatus })
      updateUscitaStatus(comanda.order_id, kdsStatusId, res.data.status, new Date().toISOString())
    } catch (_) {
      // il WebSocket aggiornerà lo stato
    }
  }

  const handleCall = async (kdsStatusId) => {
    try {
      await api.patch(`/kds/statuses/${kdsStatusId}/call`)
      markCalled(comanda.order_id, kdsStatusId)
    } catch (_) {
      // il WebSocket aggiornerà lo stato
    }
  }

  const suffixLabel = comanda.table_suffix ? ` ${comanda.table_suffix.toUpperCase()}` : ''
  const zoneLabel = comanda.zone_name ? ` · ${comanda.zone_name}` : ''
  const tableLabel = `TAV. ${comanda.table_number}${suffixLabel}${zoneLabel}`
  const completedTs = comanda.completed_at ? new Date(comanda.completed_at).getTime() : null

  return (
    <div
      className={isNew ? 'kds-new' : ''}
      style={{
        background: 'var(--kds-surface)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'var(--kds-text-primary)',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--kds-border)',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{tableLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--kds-text-muted)', marginTop: 2 }}>
            ordine #{comanda.order_number}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {completedTs ? (
            <span style={{
              fontSize: 13,
              color: 'var(--kds-pronto-accent)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              Sparisce in <Countdown fromTs={completedTs} onExpire={() => removeComanda(comanda.order_id)} />
            </span>
          ) : null}
          <span style={{ fontSize: 17, color: 'var(--kds-text-muted)' }}>⏱ {timeLabel}</span>
        </div>
      </div>

      {/* ── Uscite ── */}
      <div style={{ padding: '8px 10px', flex: 1 }}>
        {comanda.uscite.map((uscita) => (
          <UscitaBlock
            key={uscita.uscita}
            uscita={uscita}
            department={department}
            onStatusUpdate={handleStatusUpdate}
            onCall={handleCall}
          />
        ))}
      </div>
    </div>
  )
}

function btnBase(disabled) {
  return {
    fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
    padding: '5px 12px', borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    transition: 'opacity 0.15s',
  }
}

function btnInCorso(disabled) {
  return {
    ...btnBase(disabled),
    background: 'transparent',
    border: '1px solid var(--kds-in-corso-accent)',
    color: 'var(--kds-in-corso-accent)',
  }
}

function btnPronta(disabled) {
  return {
    ...btnBase(disabled),
    background: 'var(--kds-pronto-accent)',
    border: '1px solid var(--kds-pronto-accent)',
    color: '#0f0f0f',
    fontWeight: 700,
  }
}

function btnNeutral() {
  return {
    ...btnBase(false),
    background: 'transparent',
    border: '1px solid var(--kds-border)',
    color: 'var(--kds-text-secondary)',
  }
}

function btnChiama(accent, disabled) {
  return {
    ...btnBase(disabled),
    background: accent,
    border: `1px solid ${accent}`,
    color: '#0f0f0f',
    fontWeight: 700,
  }
}

// Vista bar: per ogni uscita, i reparti cucina/pizzeria da chiamare (o il loro stato se già chiamati).
function BarCallTargets({ targets, onCall }) {
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {targets.map((t) => (
        <BarCallTarget key={t.department} target={t} onCall={onCall} />
      ))}
    </div>
  )
}

function BarCallTarget({ target, onCall }) {
  const [calling, setCalling] = useState(false)
  const accent = DEPT_ACCENT[target.department]
  const label = DEPT_LABEL[target.department]
  const statusMeta = deptStatusMeta(target.status)
  // Mostra "Chiama" solo se il reparto è ancora da avviare e non già chiamato.
  const showCallButton = !target.called && target.status === 'pending'

  const handleCall = async () => {
    if (calling) return
    setCalling(true)
    try {
      await onCall(target.kds_status_id)
    } finally {
      setCalling(false)
    }
  }

  return (
    <div style={{
      border: '1px solid var(--kds-border)',
      borderLeft: `4px solid ${accent}`,
      borderRadius: 4,
      padding: '6px 8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: '0.05em' }}>
          {label}
        </span>
        {showCallButton ? (
          <button onClick={handleCall} disabled={calling} style={btnChiama(accent, calling)}>
            Chiama {label}
          </button>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: statusMeta.color }}>
            {statusMeta.icon} {statusMeta.label}
          </span>
        )}
      </div>

      {target.items?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {target.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginTop: 2, lineHeight: 1.3 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: accent, minWidth: 24, flexShrink: 0 }}>
                {item.quantity}×
              </span>
              <span style={{ fontSize: 13, color: 'var(--kds-text-secondary)' }}>{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
