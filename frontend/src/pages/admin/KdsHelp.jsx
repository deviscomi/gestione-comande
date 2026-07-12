import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

// I tre display KDS vivono a URL diretti (nessun login su LAN fidata). Qui li
// esponiamo con accesso rapido + una guida d'uso: vedi ModuleGate slug="kds".
const DEPTS = [
  { slug: 'cucina',   label: 'Cucina',   accent: 'var(--kds-cucina-accent)' },
  { slug: 'pizzeria', label: 'Pizzeria', accent: 'var(--kds-pizzeria-accent)' },
  { slug: 'bar',      label: 'Bar',      accent: 'var(--kds-bar-accent)' },
]

// Il pannello gira su HTTP in LAN (contesto non sicuro): navigator.clipboard
// spesso non esiste, quindi fallback su un textarea temporaneo + execCommand.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch { /* contesto non sicuro: prova il fallback */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

const sectionTitle = {
  margin: '28px 0 12px', fontSize: 14, fontWeight: 700,
  color: 'var(--color-text-primary)',
}
const bodyText = {
  margin: '0 0 10px', fontSize: 13, lineHeight: 1.55,
  color: 'var(--color-text-secondary)',
}

function DisplayCard({ dept, origin }) {
  const url = `${origin}/kds/${dept.slug}`
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (await copyText(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div style={{
      border: '1px solid var(--color-border-tertiary)',
      borderTop: `3px solid ${dept.accent}`,
      borderRadius: 10, padding: 16,
      background: 'var(--color-background-secondary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dept.accent }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>{dept.label}</span>
      </div>

      {/* QR su fondo bianco fisso: dev'essere leggibile anche in dark mode */}
      <div style={{ background: '#ffffff', padding: 8, borderRadius: 8, lineHeight: 0 }}>
        <QRCodeSVG value={url} size={124} level="M" />
      </div>

      <code style={{
        fontSize: 11, wordBreak: 'break-all', textAlign: 'center',
        color: 'var(--color-text-tertiary)', width: '100%',
      }}>{url}</code>

      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button onClick={handleCopy} style={{
          flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          border: '1px solid var(--color-border-secondary)',
          background: 'transparent',
          color: copied ? 'var(--color-text-success)' : 'var(--color-text-secondary)',
        }}>
          {copied ? 'Copiato!' : 'Copia URL'}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, textAlign: 'center',
          textDecoration: 'none',
          border: '1px solid var(--color-border-info)',
          background: 'var(--color-background-info)', color: 'var(--color-text-info)',
        }}>
          Apri
        </a>
      </div>
    </div>
  )
}

function StatePill({ color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: 'var(--color-text-secondary)',
    }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0 }} />
      {children}
    </span>
  )
}

export default function KdsHelp() {
  const origin = window.location.origin

  return (
    <div style={{ padding: 28, maxWidth: 860 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>KDS — Kitchen Display System</h2>
      <p style={bodyText}>
        Il KDS mostra le comande in tempo reale su schermi dedicati, uno per reparto.
        Ogni display si apre a un URL diretto e non richiede login sulla rete locale
        fidata: aprilo sullo schermo di cucina, pizzeria o bar e lascialo sempre acceso.
      </p>

      {/* ── Accesso rapido ai display ────────────────────────────────────── */}
      <h3 style={sectionTitle}>Accesso rapido ai display</h3>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
      }}>
        {DEPTS.map(d => <DisplayCard key={d.slug} dept={d} origin={origin} />)}
      </div>

      <div style={{
        marginTop: 14, padding: '10px 14px', borderRadius: 8,
        background: 'var(--color-background-info)', color: 'var(--color-text-info)',
        fontSize: 12.5, lineHeight: 1.5,
        border: '1px solid var(--color-border-info)',
      }}>
        Gli URL e i QR usano l'indirizzo con cui stai visitando questo pannello
        (<code>{origin}</code>). Per configurare gli schermi in sala, apri il pannello
        tramite l'IP o il nome host del server in LAN — non <code>localhost</code> — altrimenti
        il QR punterà a localhost e non sarà raggiungibile dagli altri dispositivi.
      </div>

      {/* ── Come funziona il display ─────────────────────────────────────── */}
      <h3 style={sectionTitle}>Come funziona il display</h3>

      <p style={{ ...bodyText, marginBottom: 6 }}><strong style={{ color: 'var(--color-text-primary)' }}>Stati di ogni uscita</strong> — tocca il pulsante per far avanzare lo stato:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '0 0 12px' }}>
        <StatePill color="var(--kds-pending-accent)">In attesa</StatePill>
        <StatePill color="var(--kds-in-corso-accent)">In corso — tocca «IN CORSO» quando inizi</StatePill>
        <StatePill color="var(--kds-pronto-accent)">Pronto — tocca «PRONTO ✓» quando finisci</StatePill>
      </div>

      <p style={bodyText}>
        <strong style={{ color: 'var(--color-text-primary)' }}>Coordinamento tra reparti.</strong> Quando il
        bar è aperto (da Calendario) è lui a coordinare le andate: cucina e pizzeria restano in
        «IN ATTESA» finché il bar non le chiama. Quando il bar è chiuso, coordina la cucina.
      </p>
      <p style={bodyText}>
        <strong style={{ color: 'var(--color-text-primary)' }}>Audio.</strong> Un beep segnala ogni nuovo
        ordine in arrivo. <strong style={{ color: 'var(--color-text-primary)' }}>Coda.</strong> Le comande
        completate spariscono automaticamente dopo circa 3 minuti.
      </p>

      <p style={{ ...bodyText, marginBottom: 6 }}><strong style={{ color: 'var(--color-text-primary)' }}>Colori delle modifiche</strong> sugli articoli:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '0 0 4px' }}>
        <StatePill color="var(--kds-var-remove)">SENZA</StatePill>
        <StatePill color="var(--kds-var-add)">AGG.</StatePill>
        <StatePill color="var(--kds-var-less)">POCO</StatePill>
        <StatePill color="var(--kds-var-more)">ABBOND.</StatePill>
      </div>

      {/* ── Allestire uno schermo dedicato ───────────────────────────────── */}
      <h3 style={sectionTitle}>Allestire uno schermo dedicato</h3>
      <p style={bodyText}>
        Apri l'URL del reparto sullo schermo o tablet in postazione, mettilo a schermo intero
        (modalità kiosk se disponibile) e lascialo aperto: la pagina si aggiorna da sola in tempo
        reale, senza ricaricare. In accesso remoto o con token può servire aggiungere
        <code> ?kds_token=…</code> all'URL — è una configurazione lato fornitore; sulla rete locale
        fidata non serve.
      </p>
    </div>
  )
}
