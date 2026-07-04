import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useSettingsStore } from '../../store/useSettingsStore'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login, user }         = useAuthStore()
  const { fetchSettings }       = useSettingsStore()
  const navigate                = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      await fetchSettings()
      const role = useAuthStore.getState().user?.role
      navigate(
        role === 'admin' || role === 'super_admin' || role === 'cashier' ? '/admin' : '/'
      )
    } catch {
      setError('Credenziali non valide')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-background-primary)'
    }}>
      <div style={{
        width: 320, padding: 32, borderRadius: 12,
        background: 'var(--color-background-secondary)',
        border: '1px solid var(--color-border-tertiary)',
        boxShadow: '0 4px 24px rgba(0,0,0,.08)'
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Gestione Comande</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
          Accedi al tuo account
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              Username
            </label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" required
              style={{
                width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 8,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" required
              style={{
                width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 8,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: '7px 10px', borderRadius: 8, fontSize: 12,
              background: 'var(--color-background-danger)',
              color: 'var(--color-text-danger)',
              border: '1px solid var(--color-border-danger)'
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '9px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none',
            opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
