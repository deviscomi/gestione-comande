import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useAuthStore } from '../../store/useAuthStore'

export default function PinLock() {
  const [locked, setLocked] = useState(false)
  const [input, setInput]   = useState('')
  const [shake, setShake]   = useState(false)
  const timerRef            = useRef(null)
  const { pin, timeout }    = useSettingsStore()
  const { token, user }     = useAuthStore()

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setLocked(true), timeout * 1000)
  }, [timeout])

  useEffect(() => {
    if (!token || user?.role !== 'waiter') return
    resetTimer()
    const events = ['touchstart', 'click', 'keydown', 'scroll']
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }))
    return () => {
      clearTimeout(timerRef.current)
      events.forEach(e => document.removeEventListener(e, resetTimer))
    }
  }, [token, resetTimer])

  useEffect(() => {
    const handler = () => setLocked(true)
    window.addEventListener('force-lock', handler)
    return () => window.removeEventListener('force-lock', handler)
  }, [])

  function handleDigit(d) {
    const next = input + d
    setInput(next)
    if (next.length === pin.length) {
      if (next === pin) {
        setLocked(false)
        setInput('')
        resetTimer()
      } else {
        setShake(true)
        setTimeout(() => { setShake(false); setInput('') }, 600)
      }
    }
  }

  function handleBackspace() {
    setInput(p => p.slice(0, -1))
  }

  if (!locked || !token || user?.role !== 'waiter') return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--color-background-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>Schermo bloccato</div>
      <p style={{ marginBottom: 24, color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Inserisci il PIN per sbloccare
      </p>

      {/* Indicatori PIN */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        {Array.from({ length: pin.length }).map((_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < input.length
              ? 'var(--color-text-info)'
              : 'var(--color-border-secondary)',
            transition: 'background .15s'
          }} />
        ))}
      </div>

      {/* Tastierino */}
      <div className={shake ? 'pin-shake' : ''} style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: 210
      }}>
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
          <button
            key={i}
            onClick={() => {
              if (typeof d === 'number') handleDigit(String(d))
              else if (d === '⌫') handleBackspace()
            }}
            style={{
              padding: '14px 0', fontSize: 20, fontWeight: 500,
              borderRadius: 10, border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)',
              opacity: d === '' ? 0 : 1,
              pointerEvents: d === '' ? 'none' : 'auto',
              transition: 'background .1s'
            }}
          >{d}</button>
        ))}
      </div>
    </div>
  )
}
