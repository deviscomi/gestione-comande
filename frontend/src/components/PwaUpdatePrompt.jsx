import { useRegisterSW } from 'virtual:pwa-register/react'

// Proposta di aggiornamento PWA (registerType: 'prompt'): quando è pronta una
// nuova versione del service worker, mostra un avviso e applica l'update solo
// su conferma dell'operatore (evita reload a sorpresa durante una comanda).
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      borderRadius: 10,
      background: 'var(--color-background-secondary)',
      border: '1px solid var(--color-border-secondary)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      fontSize: 13,
      color: 'var(--color-text-primary)',
    }}>
      <span>È disponibile un aggiornamento.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', border: 'none',
          background: 'var(--color-background-info)', color: 'var(--color-text-info)',
        }}
      >
        Aggiorna
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        style={{
          padding: '5px 10px', borderRadius: 7, fontSize: 12,
          cursor: 'pointer', background: 'transparent',
          border: '1px solid var(--color-border-secondary)',
          color: 'var(--color-text-secondary)',
        }}
      >
        Più tardi
      </button>
    </div>
  )
}
