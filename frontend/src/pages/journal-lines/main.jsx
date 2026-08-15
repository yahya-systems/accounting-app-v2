import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllJournalLines } from '../../api/client'
import { formatAmount } from '../../utils/format'
import Table from '../../components/Table'
import Popup from '../../components/Popup'
import FilterBar from '../../components/FilterBar'
import JournalLineDetailPopup from '../../components/JournalLineDetailPopup'
import CreateJournalLinePopup from '../../components/CreateJournalLinePopup'
import './JournalLines.css'

const FILTER_SCHEMA = [
  { key: 'from', label: 'Du', type: 'date', param: 'from' },
  { key: 'to', label: 'Au', type: 'date', param: 'to' },
  { key: 'accountId', label: 'Compte (préfixe)', type: 'text', param: 'account_id', placeholder: '4481', maxLength: 10 },
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    param: 'type',
    options: [
      { value: 'debit', label: 'Débit' },
      { value: 'credit', label: 'Crédit' },
    ],
  },
  { key: 'description', label: 'Description', type: 'text', param: 'description', placeholder: 'Recherche' },
]

const COLUMNS = [
  { key: 'date', label: 'Date', sortable: true, width: 12, render: (v) => v?.slice(0, 10) },
  { key: 'account_id', label: 'Compte (id)', sortable: true, width: 14 },
  { key: 'account_name', label: 'Compte', sortable: true, width: 18 },
  { key: 'journal_name', label: 'Journal', sortable: true, width: 16 },
  {
    key: 'debit_amount',
    label: 'Débit',
    sortable: true,
    align: 'right',
    width: 15,
    render: formatAmount,
  },
  {
    key: 'credit_amount',
    label: 'Crédit',
    sortable: true,
    align: 'right',
    width: 15,
    render: formatAmount,
  },
]

export default function JournalLines() {
  const [appliedParams, setAppliedParams] = useState({})

  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState(null)

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setError(null)

    getAllJournalLines(appliedParams)
      .then((data) => {
        if (cancelled) return
        setLines(data)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [appliedParams, refreshKey])

  const rows = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        account_id: line.account?.id ?? null,
        account_name: line.account?.name ?? null,
        journal_name: line.journal?.name ?? null,
      })),
    [lines],
  )

  function handleLineCreated() {
    setRefreshKey((k) => k + 1)
  }

  function handleLineUpdated() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="journal-lines">
      <header className="page-header">
        <h1>Écritures</h1>
        <div className="journal-lines-header-actions">
          <button
            type="button"
            className="button journal-lines-create"
            onClick={() => setIsCreateOpen(true)}
            aria-label="Créer une écriture"
            title="Créer une écriture"
          >
            +
          </button>
          <Link to="/" className="button">
            Journaux
          </Link>
        </div>
      </header>

      <FilterBar schema={FILTER_SCHEMA} onApply={setAppliedParams} />

      <div className="journal-lines-table-container">
        {status === 'loading' && <p className="muted">Chargement…</p>}
        {status === 'error' && <p className="error">Échec du chargement des écritures : {error}</p>}
        {status === 'ready' && (
          <Table
            columns={COLUMNS}
            data={rows}
            emptyMessage="Aucune écriture."
            onRowClick={(line) => setSelectedLineId(line.id)}
          />
        )}
      </div>

      <Popup
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Créer une écriture"
      >
        <CreateJournalLinePopup onClose={() => setIsCreateOpen(false)} onCreated={handleLineCreated} />
      </Popup>

      <Popup
        open={selectedLineId !== null}
        onClose={() => setSelectedLineId(null)}
        title="Écriture"
      >
        {selectedLineId !== null && (
          <JournalLineDetailPopup
            lineId={selectedLineId}
            onClose={() => setSelectedLineId(null)}
            onUpdated={handleLineUpdated}
          />
        )}
      </Popup>
    </div>
  )
}
