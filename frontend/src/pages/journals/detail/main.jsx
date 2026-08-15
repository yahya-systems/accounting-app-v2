import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getJournal, getJournalLines, updateJournal } from '../../../api/client'
import { formatAmount } from '../../../utils/format'
import Table from '../../../components/Table'
import Popup from '../../../components/Popup'
import FilterBar from '../../../components/FilterBar'
import JournalLineDetailPopup from '../../../components/JournalLineDetailPopup'
import CreateJournalLinePopup from '../../../components/CreateJournalLinePopup'
import EditJournalPopup from './EditJournalPopup'
import './JournalDetail.css'

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
  { key: 'date', label: 'Date', sortable: true, width: 14, render: (v) => v?.slice(0, 10) },
  {
    key: 'account_pcg_code',
    label: 'Numéro PCG',
    sortable: true,
    width: 16,
  },
  {
    key: 'account_name',
    label: 'Compte',
    sortable: true,
    width: 24,
  },
  {
    key: 'debit_amount',
    label: 'Débit',
    sortable: true,
    align: 'right',
    width: 16,
    render: formatAmount,
  },
  {
    key: 'credit_amount',
    label: 'Crédit',
    sortable: true,
    align: 'right',
    width: 16,
    render: formatAmount,
  },
]

export default function JournalDetail() {
  const { id } = useParams()

  const [journal, setJournal] = useState(null)
  const [journalStatus, setJournalStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [journalError, setJournalError] = useState(null)
  const [journalRefreshKey, setJournalRefreshKey] = useState(0)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false)
  const [deactivateStatus, setDeactivateStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [deactivateError, setDeactivateError] = useState(null)

  const [appliedParams, setAppliedParams] = useState({})

  const [lines, setLines] = useState([])
  const [linesStatus, setLinesStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [linesError, setLinesError] = useState(null)
  const [linesRefreshKey, setLinesRefreshKey] = useState(0)

  const [isCreateLineOpen, setIsCreateLineOpen] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState(null)

  useEffect(() => {
    let cancelled = false

    setJournalStatus('loading')
    setJournalError(null)

    getJournal(id)
      .then((data) => {
        if (cancelled) return
        setJournal(data)
        setJournalStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setJournalError(err.message)
        setJournalStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [id, journalRefreshKey])

  useEffect(() => {
    let cancelled = false

    setLinesStatus('loading')
    setLinesError(null)

    getJournalLines(id, appliedParams)
      .then((data) => {
        if (cancelled) return
        setLines(data)
        setLinesStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLinesError(err.message)
        setLinesStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [id, appliedParams, linesRefreshKey])

  const rows = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        account_pcg_code: line.account?.id ?? null,
        account_name: line.account?.name ?? null,
      })),
    [lines],
  )

  function handleJournalUpdated() {
    setJournalRefreshKey((k) => k + 1)
  }

  function handleLineCreated() {
    setLinesRefreshKey((k) => k + 1)
  }

  function handleLineUpdated() {
    setLinesRefreshKey((k) => k + 1)
  }

  async function handleConfirmDeactivate() {
    setDeactivateStatus('working')
    setDeactivateError(null)

    try {
      await updateJournal(id, { is_active: false })
      setIsDeactivateConfirmOpen(false)
      setDeactivateStatus('idle')
      setJournalRefreshKey((k) => k + 1)
    } catch (err) {
      setDeactivateError(err.message)
      setDeactivateStatus('error')
    }
  }

  return (
    <div className="journal-detail">
      <header className="page-header">
        <h1>Journal</h1>
        <Link to="/" className="button">
          Retour
        </Link>
      </header>

      {journalStatus === 'loading' && <p className="muted">Chargement…</p>}
      {journalStatus === 'error' && (
        <p className="error">Échec du chargement du journal : {journalError}</p>
      )}
      {journalStatus === 'ready' && journal && (
        <div className="journal-detail-info">
          <div className="journal-detail-info-header">
            <div>
              <h2>{journal.name}</h2>
              <span className="journal-detail-id">{journal.id}</span>
              {journal.description && (
                <span className="journal-detail-description">{journal.description}</span>
              )}
              <span className="journal-detail-created-at">
                Créé le {journal.created_at?.slice(0, 10)}
              </span>
              <span className="badge">{journal.is_active ? 'Actif' : 'Inactif'}</span>
            </div>
            <div className="journal-detail-info-actions">
              <button type="button" className="button" onClick={() => setIsEditOpen(true)}>
                Modifier le journal
              </button>
              {journal.is_active && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setDeactivateError(null)
                    setIsDeactivateConfirmOpen(true)
                  }}
                >
                  Désactiver le journal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="journal-detail-filter-row">
        <FilterBar schema={FILTER_SCHEMA} onApply={setAppliedParams} />
        <button
          type="button"
          className="button journal-detail-create-line"
          onClick={() => setIsCreateLineOpen(true)}
        >
          Créer une écriture
        </button>
      </div>

      <div className="journal-detail-table-container">
        {linesStatus === 'loading' && <p className="muted">Chargement…</p>}
        {linesStatus === 'error' && (
          <p className="error">Échec du chargement des écritures : {linesError}</p>
        )}
        {linesStatus === 'ready' && (
          <Table
            columns={COLUMNS}
            data={rows}
            emptyMessage="Aucune écriture."
            onRowClick={(line) => setSelectedLineId(line.id)}
          />
        )}
      </div>

      {journal && (
        <Popup open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modifier le journal">
          <EditJournalPopup
            journal={journal}
            onClose={() => setIsEditOpen(false)}
            onUpdated={handleJournalUpdated}
          />
        </Popup>
      )}

      <Popup
        open={isCreateLineOpen}
        onClose={() => setIsCreateLineOpen(false)}
        title="Créer une écriture"
      >
        <CreateJournalLinePopup
          journalId={id}
          onClose={() => setIsCreateLineOpen(false)}
          onCreated={handleLineCreated}
        />
      </Popup>

      <Popup
        open={isDeactivateConfirmOpen}
        onClose={() => setIsDeactivateConfirmOpen(false)}
        title="Désactiver le journal"
      >
        <div className="deactivate-confirm">
          <p>Voulez-vous vraiment désactiver ce journal ?</p>
          {deactivateStatus === 'error' && <p className="error">{deactivateError}</p>}
          <div className="form-actions">
            <button
              type="button"
              className="button"
              onClick={() => setIsDeactivateConfirmOpen(false)}
              disabled={deactivateStatus === 'working'}
            >
              Annuler
            </button>
            <button
              type="button"
              className="button"
              onClick={handleConfirmDeactivate}
              disabled={deactivateStatus === 'working'}
            >
              {deactivateStatus === 'working' ? 'Désactivation…' : 'Désactiver'}
            </button>
          </div>
        </div>
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
