import { Component } from 'react'

// Rete anti-pagina-bianca: cattura gli errori di render dei figli e mostra un
// fallback leggibile invece di lasciare la SPA su uno schermo vuoto.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // In produzione questo finisce solo in console del client; utile per il debug.
    console.error('ErrorBoundary:', error, info?.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
        background: 'var(--color-background-primary)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Si è verificato un errore imprevisto
        </div>
        <div style={{ fontSize: 13, maxWidth: 420, lineHeight: 1.5 }}>
          La pagina non può essere mostrata. Ricarica per riprovare; se il problema
          persiste contatta l'assistenza.
        </div>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: 4,
            padding: '8px 18px',
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer',
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-info)',
            color: 'var(--color-text-info)',
          }}
        >
          Ricarica
        </button>
      </div>
    )
  }
}
