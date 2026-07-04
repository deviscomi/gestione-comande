import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'
import { useAuthStore } from '../../store/useAuthStore'

export default function Waiters() {
  const qc = useQueryClient()
  const { user: me } = useAuthStore()
  const isSuperAdmin = me?.role === 'super_admin'

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', surname: '', username: '', password: '', pin: '', role: 'waiter' })
  const [formError, setFormError] = useState('')

  const [pinModal, setPinModal] = useState(null)
  const [newPin, setNewPin] = useState('')

  const [passwordModal, setPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState('')

  const [pwModal, setPwModal] = useState(null)
  const [newPw, setNewPw] = useState('')

  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', surname: '', username: '' })
  const [editError, setEditError] = useState('')

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.getUsers().then(r => r.data.data),
  })

  const createMut = useMutation({
    mutationFn: (d) => adminApi.createUser(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowForm(false)
      setForm({ name: '', surname: '', username: '', password: '', pin: '', role: 'waiter' })
      setFormError('')
    },
    onError: (e) => setFormError(e.response?.data?.message ?? 'Errore creazione utente'),
  })

  const toggleMut = useMutation({
    mutationFn: (id) => adminApi.toggleUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => alert(e.response?.data?.message ?? 'Errore'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => adminApi.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => alert(e.response?.data?.message ?? 'Impossibile eliminare utente'),
  })

  const pinMut = useMutation({
    mutationFn: ({ id, pin }) => adminApi.updatePin(id, pin),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setPinModal(null); setNewPin('') },
  })

  const forceLogoutMut = useMutation({
    mutationFn: (id) => adminApi.forceLogout(id),
  })

  const changePasswordMut = useMutation({
    mutationFn: (password) => adminApi.updateUser(me.id, { password }),
    onSuccess: () => { setPasswordModal(false); setNewPassword(''); setPwError('') },
    onError: (e) => setPwError(e.response?.data?.message ?? 'Errore cambio password'),
  })

  const pwMut = useMutation({
    mutationFn: ({ id, password }) => adminApi.updateUser(id, { password }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setPwModal(null); setNewPw('') },
  })

  const editMut = useMutation({
    mutationFn: ({ id, ...data }) => adminApi.updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditModal(null); setEditError('') },
    onError: (e) => setEditError(e.response?.data?.message ?? 'Errore salvataggio'),
  })

  const ROLE_BADGE = {
    super_admin: { bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
    admin:       { bg: 'var(--color-background-info)',    color: 'var(--color-text-info)'    },
    waiter:      { bg: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
    cashier:     { bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
  }
  const STATUS_BADGE = {
    active:   { bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
    inactive: { bg: 'var(--color-background-danger)',  color: 'var(--color-text-danger)' },
  }

  const btnBase = {
    fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid var(--color-border-secondary)',
    background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)',
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Gestione utenti</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPasswordModal(true)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-secondary)', cursor: 'pointer',
          }}>Cambia password</button>
          <button onClick={() => setShowForm(true)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
          }}>+ Aggiungi utente</button>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--color-background-secondary)' }}>
            {['Nome', 'Username', 'Ruolo', 'Stato', 'PIN', 'Azioni'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users?.map(user => {
            const rb = ROLE_BADGE[user.role] ?? ROLE_BADGE.waiter
            const sb = STATUS_BADGE[user.status] ?? STATUS_BADGE.inactive
            const isSelf = user.id === me?.id
            const targetIsSuperAdmin = user.role === 'super_admin'
            const targetIsAdmin = user.role === 'admin'
            const targetIsWaiter = user.role === 'waiter'
            const targetIsCashier = user.role === 'cashier'

            const canEditCredentials = !targetIsSuperAdmin && (
              isSuperAdmin ||
              targetIsWaiter ||
              targetIsCashier ||
              isSelf
            )

            const canDelete = !isSelf && !targetIsSuperAdmin && (
              isSuperAdmin ||
              targetIsWaiter ||
              targetIsCashier
            )

            const canToggle = targetIsWaiter || targetIsCashier
            return (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                <td style={{ padding: '10px 12px' }}>
                  {user.name} {user.surname}
                  {isSelf && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--color-text-tertiary)' }}>(tu)</span>}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{user.username}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, background: rb.bg, color: rb.color }}>{user.role}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, background: sb.bg, color: sb.color }}>{user.status}</span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>{'•'.repeat(user.pin?.length ?? 4)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {canToggle && (
                      <button onClick={() => toggleMut.mutate(user.id)} style={btnBase}>
                        {user.status === 'active' ? 'Disattiva' : 'Attiva'}
                      </button>
                    )}
                    {canEditCredentials && (
                      <button onClick={() => { setPinModal(user); setNewPin('') }} style={btnBase}>
                        Cambia PIN
                      </button>
                    )}
                    {canEditCredentials && (
                      <button onClick={() => { setPwModal(user); setNewPw('') }} style={btnBase}>
                        Cambia password
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        onClick={() => { if (window.confirm(`Disconnetti ${user.name}?`)) forceLogoutMut.mutate(user.id) }}
                        style={{ ...btnBase, border: '1px solid var(--color-border-warning)', background: 'transparent', color: 'var(--color-text-warning)' }}
                      >
                        Force logout
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => { if (window.confirm(`Elimina ${user.name} ${user.surname}?`)) deleteMut.mutate(user.id) }}
                        style={{ ...btnBase, border: '1px solid var(--color-border-danger)', background: 'transparent', color: 'var(--color-text-danger)' }}
                      >
                        Elimina
                      </button>
                    )}
                    {targetIsSuperAdmin && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Account protetto</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {showForm && (
        <Modal title="Nuovo utente" onClose={() => { setShowForm(false); setFormError('') }}>
          {[
            { key: 'name', label: 'Nome' },
            { key: 'surname', label: 'Cognome' },
            { key: 'username', label: 'Username' },
            { key: 'password', label: 'Password', type: 'password' },
            { key: 'pin', label: 'PIN (4-6 cifre)', type: 'number' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input
                type={f.type ?? 'text'}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Ruolo</label>
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }}
            >
              <option value="waiter">Cameriere</option>
              <option value="cashier">Cassiere</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {formError && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{formError}</div>}
          <button
            onClick={() => createMut.mutate(form)}
            disabled={createMut.isPending}
            style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: createMut.isPending ? 0.7 : 1, cursor: 'pointer' }}
          >
            {createMut.isPending ? 'Salvataggio...' : 'Crea utente'}
          </button>
        </Modal>
      )}

      {pinModal && (
        <Modal title={`Cambia PIN — ${pinModal.name}`} onClose={() => setPinModal(null)}>
          <input
            type="number"
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            placeholder="Nuovo PIN (4-6 cifre)"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 16, textAlign: 'center', border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', marginBottom: 12, letterSpacing: 8, boxSizing: 'border-box' }}
          />
          <button
            onClick={() => pinMut.mutate({ id: pinModal.id, pin: newPin })}
            disabled={newPin.length < 4 || pinMut.isPending}
            style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: (newPin.length < 4 || pinMut.isPending) ? 0.6 : 1, cursor: 'pointer' }}
          >
            Salva PIN
          </button>
        </Modal>
      )}

      {pwModal && (
        <Modal title={`Cambia password — ${pwModal.name}`} onClose={() => setPwModal(null)}>
          <input
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="Nuova password (min 6 caratteri)"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)', marginBottom: 12, boxSizing: 'border-box' }}
          />
          <button
            onClick={() => pwMut.mutate({ id: pwModal.id, password: newPw })}
            disabled={newPw.length < 6 || pwMut.isPending}
            style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: (newPw.length < 6 || pwMut.isPending) ? 0.6 : 1 }}
          >{pwMut.isPending ? 'Salvataggio...' : 'Salva password'}</button>
        </Modal>
      )}

      {editModal && (
        <Modal title={`Modifica — ${editModal.name} ${editModal.surname}`} onClose={() => setEditModal(null)}>
          {[
            { key: 'name', label: 'Nome' },
            { key: 'surname', label: 'Cognome' },
            { key: 'username', label: 'Username' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input
                type="text"
                value={editForm[f.key]}
                onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13,
                  border: '1px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          {editError && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{editError}</div>}
          <button
            onClick={() => editMut.mutate({ id: editModal.id, ...editForm })}
            disabled={!editForm.name.trim() || !editForm.surname.trim() || !editForm.username.trim() || editMut.isPending}
            style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: (!editForm.name.trim() || !editForm.surname.trim() || !editForm.username.trim() || editMut.isPending) ? 0.6 : 1 }}
          >{editMut.isPending ? 'Salvataggio...' : 'Salva modifiche'}</button>
        </Modal>
      )}

      {passwordModal && (
        <Modal title="Cambia la tua password" onClose={() => { setPasswordModal(false); setNewPassword(''); setPwError('') }}>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Nuova password (min. 6 caratteri)"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', marginBottom: 12, boxSizing: 'border-box' }}
          />
          {pwError && <div style={{ color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 10 }}>{pwError}</div>}
          <button
            onClick={() => changePasswordMut.mutate(newPassword)}
            disabled={newPassword.length < 6 || changePasswordMut.isPending}
            style={{ width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--color-primary)', color: '#fff', border: 'none', opacity: (newPassword.length < 6 || changePasswordMut.isPending) ? 0.6 : 1, cursor: 'pointer' }}
          >
            {changePasswordMut.isPending ? 'Salvataggio...' : 'Salva password'}
          </button>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 380, padding: 24, borderRadius: 12, background: 'var(--color-background-primary)', border: '1px solid var(--color-border-tertiary)', boxShadow: '0 8px 32px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
