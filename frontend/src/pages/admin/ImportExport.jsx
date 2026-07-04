import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../api/endpoints/admin'

const CSV_LABELS = { dishes: 'Piatti', pizzas: 'Pizze', wines: 'Vini' }

function downloadBlob(data, filename, type) {
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export default function ImportExport() {
  const today = new Date().toISOString().split('T')[0]

  const groupsQ = useQuery({
    queryKey: ['data-groups'],
    queryFn: () => adminApi.getDataGroups().then(r => r.data),
  })

  const [selectedGroups, setSelectedGroups] = useState([])
  const [format, setFormat] = useState('json')
  const [csvEntity, setCsvEntity] = useState('dishes')
  const [exportingAll, setExportingAll] = useState(false)
  const [exportingSelection, setExportingSelection] = useState(false)

  const [importFile, setImportFile] = useState(null)
  const [importMode, setImportMode] = useState('merge')
  const [importGroups, setImportGroups] = useState([])
  const [importEntity, setImportEntity] = useState('dishes')
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const quickFileRef = useRef(null)
  const advancedFileRef = useRef(null)

  const allGroups = groupsQ.data?.groups ?? []
  const isCsv = importFile && importFile.name.toLowerCase().endsWith('.csv')

  function toggleGroup(slug) {
    setSelectedGroups(p => p.includes(slug) ? p.filter(g => g !== slug) : [...p, slug])
  }

  function toggleImportGroup(slug) {
    setImportGroups(p => p.includes(slug) ? p.filter(g => g !== slug) : [...p, slug])
  }

  async function handleExportAll() {
    setExportingAll(true)
    try {
      const groups = allGroups.filter(g => !g.sensitive).map(g => g.slug)
      const res = await adminApi.exportData({ groups, format: 'json' })
      downloadBlob(res.data, `backup-config-${today}.json`, 'application/json')
    } catch (err) {
      alert(err.response?.data?.message || 'Errore durante l\'esportazione')
    } finally {
      setExportingAll(false)
    }
  }

  async function handleExportSelection() {
    setExportingSelection(true)
    try {
      if (format === 'csv') {
        const res = await adminApi.exportData({ format: 'csv', entity: csvEntity })
        downloadBlob(res.data, `${csvEntity}-${today}.csv`, 'text/csv')
      } else {
        if (selectedGroups.length === 0) {
          alert('Seleziona almeno un gruppo da esportare')
          return
        }
        const res = await adminApi.exportData({ groups: selectedGroups, format: 'json' })
        downloadBlob(res.data, `backup-config-${today}.json`, 'application/json')
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Errore durante l\'esportazione')
    } finally {
      setExportingSelection(false)
    }
  }

  function pickQuickRestore(file) {
    if (!file) return
    setImportFile(file)
    setImportMode('merge')
    setImportGroups([])
    setPreview(null)
    setError('')
    setDone(false)
  }

  function pickAdvancedFile(file) {
    if (!file) return
    setImportFile(file)
    setPreview(null)
    setError('')
    setDone(false)
  }

  function buildFormData() {
    const fd = new FormData()
    fd.append('file', importFile)
    fd.append('mode', importMode)
    if (isCsv) {
      fd.append('entity', importEntity)
    } else {
      importGroups.forEach(g => fd.append('groups[]', g))
    }
    return fd
  }

  async function handlePreview() {
    if (!importFile) return
    setPreviewing(true)
    setError('')
    setDone(false)
    try {
      const res = await adminApi.importPreview(buildFormData())
      setPreview(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante l\'anteprima')
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirmImport() {
    if (!importFile) return
    if (importMode === 'replace' && !confirm('Modalità "Sostituisci": i dati dei gruppi selezionati non presenti nel file verranno eliminati. Continuare?')) {
      return
    }
    setImporting(true)
    setError('')
    try {
      const res = await adminApi.importData(buildFormData())
      setPreview(res.data)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante l\'importazione')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Import/Export</h1>
      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 24 }}>
        Esporta e ripristina i dati di configurazione (menu, sala, stampanti, impostazioni). Non include ordini, log o dati fiscali.
      </div>

      {/* Backup rapido */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Backup rapido</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleExportAll} disabled={exportingAll} style={primaryButtonStyle}>
            {exportingAll ? 'Esportazione...' : '⬇ Esporta tutto (JSON)'}
          </button>
          <button onClick={() => quickFileRef.current?.click()} style={secondaryButtonStyle}>
            ⬆ Ripristina da backup
          </button>
          <input
            ref={quickFileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => pickQuickRestore(e.target.files[0])}
          />
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
          "Esporta tutto" include tutti i gruppi tranne gli utenti. "Ripristina" applica il file in modalità Unisci (nessun dato viene eliminato).
        </div>
      </section>

      {/* Esportazione avanzata */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Esportazione avanzata</h2>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['json', 'csv'].map(f => (
            <button key={f} onClick={() => setFormat(f)} style={tabButtonStyle(format === f)}>
              {f === 'json' ? 'JSON (backup completo)' : 'CSV (modifica massiva menu)'}
            </button>
          ))}
        </div>

        {format === 'json' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {groupsQ.isLoading && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Caricamento gruppi...</div>}
            {allGroups.map(g => (
              <label key={g.slug} style={checkboxRowStyle}>
                <input type="checkbox" checked={selectedGroups.includes(g.slug)} onChange={() => toggleGroup(g.slug)} />
                <span style={{ flex: 1 }}>{g.label}</span>
                {g.sensitive && <span style={sensitiveBadgeStyle}>dati sensibili</span>}
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{g.count} righe</span>
              </label>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {Object.keys(CSV_LABELS).map(e => (
              <button key={e} onClick={() => setCsvEntity(e)} style={tabButtonStyle(csvEntity === e)}>
                {CSV_LABELS[e]}
              </button>
            ))}
          </div>
        )}

        <button onClick={handleExportSelection} disabled={exportingSelection} style={primaryButtonStyle}>
          {exportingSelection ? 'Esportazione...' : '⬇ Esporta selezione'}
        </button>
      </section>

      {/* Importazione avanzata */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Importazione avanzata</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => advancedFileRef.current?.click()} style={secondaryButtonStyle}>
            📁 Scegli file (.json o .csv)
          </button>
          <input
            ref={advancedFileRef}
            type="file"
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={e => pickAdvancedFile(e.target.files[0])}
          />
          {importFile && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{importFile.name}</span>}
        </div>

        {importFile && isCsv && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Entità CSV</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.keys(CSV_LABELS).map(e => (
                <button key={e} onClick={() => setImportEntity(e)} style={tabButtonStyle(importEntity === e)}>
                  {CSV_LABELS[e]}
                </button>
              ))}
            </div>
          </div>
        )}

        {importFile && !isCsv && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Modalità</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setImportMode('merge')} style={tabButtonStyle(importMode === 'merge')}>Unisci</button>
                <button onClick={() => setImportMode('replace')} style={tabButtonStyle(importMode === 'replace')}>Sostituisci</button>
              </div>
              {importMode === 'replace' && (
                <div style={{ fontSize: 11, color: 'var(--color-text-danger)', marginTop: 6 }}>
                  Attenzione: i dati dei gruppi selezionati non presenti nel file verranno eliminati.
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Gruppi (vuoto = tutti quelli presenti nel file)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allGroups.map(g => (
                  <label key={g.slug} style={checkboxRowStyle}>
                    <input type="checkbox" checked={importGroups.includes(g.slug)} onChange={() => toggleImportGroup(g.slug)} />
                    <span>{g.label}</span>
                    {g.sensitive && <span style={sensitiveBadgeStyle}>dati sensibili</span>}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {importFile && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={handlePreview} disabled={previewing} style={secondaryButtonStyle}>
              {previewing ? 'Analisi...' : 'Anteprima'}
            </button>
            <button onClick={handleConfirmImport} disabled={importing} style={primaryButtonStyle}>
              {importing ? 'Importazione...' : 'Conferma importazione'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {done && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--color-background-success)', color: 'var(--color-text-success)', fontSize: 12, marginBottom: 14 }}>
            ✓ Importazione completata
          </div>
        )}

        {preview && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-background-secondary)' }}>
                {['Gruppo', 'Nuovi', 'Aggiornati', 'Invariati', 'Eliminati', 'Conflitti'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10.5, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(preview.groups ?? {}).map(([slug, s]) => (
                <tr key={slug} style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                  <td style={{ padding: '8px 10px' }}>{allGroups.find(g => g.slug === slug)?.label ?? slug}</td>
                  <td style={{ padding: '8px 10px' }}>{s.created}</td>
                  <td style={{ padding: '8px 10px' }}>{s.updated}</td>
                  <td style={{ padding: '8px 10px' }}>{s.unchanged}</td>
                  <td style={{ padding: '8px 10px' }}>{s.deleted}</td>
                  <td style={{ padding: '8px 10px', color: s.conflicts > 0 ? 'var(--color-text-danger)' : undefined }}>{s.conflicts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {preview && Object.values(preview.groups ?? {}).some(s => s.errors?.length > 0) && (
          <ul style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-danger)', paddingLeft: 18 }}>
            {Object.values(preview.groups).flatMap(s => s.errors).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </section>
    </div>
  )
}

const sectionStyle = {
  marginBottom: 24, padding: 18, borderRadius: 10,
  background: 'var(--color-background-secondary)',
  border: '1px solid var(--color-border-tertiary)',
}

const sectionTitleStyle = { fontSize: 14, fontWeight: 700, marginBottom: 14 }

const primaryButtonStyle = {
  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer',
}

const secondaryButtonStyle = {
  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  border: '1px solid var(--color-border-secondary)',
  background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer',
}

function tabButtonStyle(active) {
  return {
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    border: '1px solid var(--color-border-secondary)',
    background: active ? 'var(--color-background-info)' : 'var(--color-background-primary)',
    color: active ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
  }
}

const checkboxRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
  padding: '6px 10px', borderRadius: 6, background: 'var(--color-background-primary)',
}

const sensitiveBadgeStyle = {
  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
  background: 'var(--color-background-danger)', color: 'var(--color-text-danger)',
}
