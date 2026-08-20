import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { themeBalham } from 'ag-grid-community'
import {
  getJournals,
  getJournalBalance,
  getJournalLines,
  updateJournal,
} from '@api/client'
import { formatAmount } from '@utils/format'
import Popup from '@components/Popup'
import FilterBar from '@components/FilterBar'
import JournalLineDetailPopup from '@components/JournalLineDetailPopup'
import CreateTransactionPopup from '@components/CreateTransactionPopup'
import EditJournalPopup from '@pages/journals/detail/EditJournalPopup'
import CreateJournalPopup from './CreateJournalPopup'
import PencilIcon from '@components/PencilIcon'
import '../journals/detail/JournalDetail.css'
import './Home.css'

// Cell renderer for the "Numéro PCG" / "Compte" columns: links straight to
// the account's detail page instead of falling through to the row click
// (which opens the line detail popup). stopPropagation is required so the
// row's onRowClicked doesn't also fire and open that popup underneath.
// (Read-only now — the outer table's inline "Modifier" edit mode was
// removed since it PATCHed journal_lines directly, an endpoint the
// transactions refactor deleted; posted lines aren't editable via the API
// at all yet.)
function AccountLinkCell(params) {
  const { value, data } = params
  const accountId = data.account?.id
  if (!accountId) return value ?? '—'
  return (
    <Link
      to={`/accounts/${accountId}`}
      className="journal-detail-account-link-cell"
      onClick={(e) => e.stopPropagation()}
    >
      {value ?? '—'}
    </Link>
  )
}

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

const SORTING_ORDER = ['asc', 'desc', null]

// Read-only column set — see note above AccountLinkCell.
function buildColumnDefs() {
  return [
    {
      field: 'date',
      headerName: 'Date',
      sortable: true,
      sortingOrder: SORTING_ORDER,
      valueFormatter: (params) => params.value?.slice(0, 10) ?? '',
      editable: false,
      flex: 1.1,
    },
    {
      field: 'account_pcg_code',
      headerName: 'Numéro PCG',
      sortable: true,
      sortingOrder: SORTING_ORDER,
      editable: false,
      cellRenderer: AccountLinkCell,
      flex: 1.3,
    },
    {
      field: 'account_name',
      headerName: 'Compte',
      sortable: true,
      sortingOrder: SORTING_ORDER,
      editable: false,
      cellRenderer: AccountLinkCell,
      flex: 1.8,
    },
    {
      field: 'debit_amount',
      headerName: 'Débit',
      sortable: false,
      type: 'rightAligned',
      cellDataType: 'number',
      valueFormatter: (params) => formatAmount(params.value),
      editable: false,
      flex: 1.3,
    },
    {
      field: 'credit_amount',
      headerName: 'Crédit',
      sortable: false,
      type: 'rightAligned',
      cellDataType: 'number',
      valueFormatter: (params) => formatAmount(params.value),
      editable: false,
      flex: 1.3,
    },
    {
      field: 'description',
      headerName: 'Description',
      sortable: false,
      editable: false,
      flex: 2.4,
    },
  ]
}

const DEFAULT_COL_DEF = {
  editable: false,
  resizable: true,
}

export default function Home() {
  const [journals, setJournals] = useState([])
  const [journalsStatus, setJournalsStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [journalsError, setJournalsError] = useState(null)

  const [journalsRefreshKey, setJournalsRefreshKey] = useState(0)
  const [isCreateJournalOpen, setIsCreateJournalOpen] = useState(false)

  const [selectedJournal, setSelectedJournal] = useState(null)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false)
  const [deactivateStatus, setDeactivateStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [deactivateError, setDeactivateError] = useState(null)

  const [appliedParams, setAppliedParams] = useState({})

  const [lines, setLines] = useState([])
  const [linesStatus, setLinesStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [linesError, setLinesError] = useState(null)
  const [linesRefreshKey, setLinesRefreshKey] = useState(0)

  const [isCreateLineOpen, setIsCreateLineOpen] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState(null)
  // Holds CreateTransactionPopup's requestClose, so Esc/overlay-click
  // (which Popup.jsx wires straight to its onClose prop) trigger the same
  // save-draft/delete confirmation as the in-popup × button, instead of
  // closing outright.
  const createTransactionCloseRequest = useRef(null)

  const [balance, setBalance] = useState(null)
  const [balanceStatus, setBalanceStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [balanceError, setBalanceError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getJournals()
      .then((data) => {
        if (cancelled) return
        setJournals(data)
        setJournalsStatus('ready')

        // Keep the selected journal's own data (e.g. type/is_active) in sync
        // after edits/deactivation, without losing the selection.
        setSelectedJournal((current) => {
          if (!current) return current
          return data.find((j) => j.id === current.id) ?? current
        })
      })
      .catch((err) => {
        if (cancelled) return
        setJournalsError(err.message)
        setJournalsStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [journalsRefreshKey])

  useEffect(() => {
    if (!selectedJournal) return
    let cancelled = false

    setLinesStatus('loading')
    setLinesError(null)

    getJournalLines(selectedJournal.id, appliedParams)
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
  }, [selectedJournal, appliedParams, linesRefreshKey])

  useEffect(() => {
    if (!selectedJournal) return
    let cancelled = false

    setBalanceStatus('loading')
    setBalanceError(null)

    const balanceParams = {}
    if (appliedParams.from) balanceParams.from = appliedParams.from
    if (appliedParams.to) balanceParams.to = appliedParams.to

    getJournalBalance(selectedJournal.id, balanceParams)
      .then((data) => {
        if (cancelled) return
        setBalance(data)
        setBalanceStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setBalanceError(err.message)
        setBalanceStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [selectedJournal, appliedParams, linesRefreshKey])

  const rows = lines.map((line) => ({
    ...line,
    account_pcg_code: line.account?.id ?? null,
    account_name: line.account?.name ?? null,
  }))

  const columnDefs = useMemo(() => buildColumnDefs(), [])

  function handleSelectJournal(journal) {
    setSelectedJournal(journal)
    setAppliedParams({})
  }

  function handleJournalCreated() {
    setJournalsRefreshKey((k) => k + 1)
  }

  function handleJournalUpdated() {
    setJournalsRefreshKey((k) => k + 1)
  }

  function handleLineCreated() {
    setLinesRefreshKey((k) => k + 1)
  }

  function handleLineUpdated() {
    setLinesRefreshKey((k) => k + 1)
  }

  function closeCreateLinePopup() {
    createTransactionCloseRequest.current = null
    setIsCreateLineOpen(false)
  }

  async function handleConfirmDeactivate() {
    if (!selectedJournal) return
    setDeactivateStatus('working')
    setDeactivateError(null)

    try {
      await updateJournal(selectedJournal.id, { is_active: false })
      setIsDeactivateConfirmOpen(false)
      setDeactivateStatus('idle')
      setJournalsRefreshKey((k) => k + 1)
    } catch (err) {
      setDeactivateError(err.message)
      setDeactivateStatus('error')
    }
  }

  return (
    <div className="home">
      <aside className="home-sidebar">
        <div className="home-sidebar-scroll">
          <header className="page-header">
            <h1>Journaux</h1>
            <button
              type="button"
              className="button home-create-journal"
              onClick={() => setIsCreateJournalOpen(true)}
              aria-label="Créer un journal"
              title="Créer un journal"
            >
              +
            </button>
          </header>

          {journalsStatus === 'loading' && <p className="muted">Chargement…</p>}
          {journalsStatus === 'error' && (
            <p className="error">Échec du chargement des journaux : {journalsError}</p>
          )}

          {journalsStatus === 'ready' && journals.length === 0 && (
            <p className="muted">Aucun journal.</p>
          )}

          {journalsStatus === 'ready' && journals.length > 0 && (
            <ul className="list">
              {journals.map((journal) => (
                <li key={journal.id} className="list-item">
                  <button
                    type="button"
                    className={
                      selectedJournal?.id === journal.id
                        ? 'list-item-button selected'
                        : 'list-item-button'
                    }
                    onClick={() => handleSelectJournal(journal)}
                  >
                    <span className="list-item-title">{journal.name}</span>
                    {journal.description && (
                      <span className="list-item-subtitle">{journal.description}</span>
                    )}
                    <span className="badge">{journal.type}</span>
                    {!journal.is_active && <span className="badge">inactif</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="home-nav-links">
          <Link to="/accounts" className="button home-nav-link">
            Comptes
          </Link>
          <Link to="/journal-lines" className="button home-nav-link">
            Écritures
          </Link>
        </div>
      </aside>

      <main className="home-main">
        {!selectedJournal && <p className="muted">Sélectionnez un journal.</p>}

        {selectedJournal && (
          <>
            <div className="journal-detail-info">
              <div className="journal-detail-info-header">
                <div>
                  <h2>{selectedJournal.name}</h2>
                  <span className="journal-detail-id">{selectedJournal.id}</span>
                  {selectedJournal.description && (
                    <span className="journal-detail-description">{selectedJournal.description}</span>
                  )}
                  <span className="journal-detail-created-at">
                    Créé le {selectedJournal.created_at?.slice(0, 10)}
                  </span>
                  <span className="badge">{selectedJournal.type}</span>
                  <span className="badge">{selectedJournal.is_active ? 'Actif' : 'Inactif'}</span>
                </div>
                <div className="journal-detail-info-actions">
                  <button
                    type="button"
                    className="button journal-detail-edit-icon icon-button"
                    onClick={() => setIsEditOpen(true)}
                    aria-label="Modifier le journal"
                    title="Modifier le journal"
                  >
                    <PencilIcon />
                  </button>
                  {selectedJournal.is_active && (
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

            <div className="journal-detail-filter-row">
              <FilterBar schema={FILTER_SCHEMA} onApply={setAppliedParams} />
              <button
                type="button"
                className="button journal-detail-create-line icon-button"
                onClick={() => setIsCreateLineOpen(true)}
                aria-label="Créer une écriture"
                title="Créer une écriture"
              >
                +
              </button>
            </div>

            <div className="journal-detail-table-container">
              {linesStatus === 'loading' && <p className="muted">Chargement…</p>}
              {linesStatus === 'error' && (
                <p className="error">Échec du chargement des écritures : {linesError}</p>
              )}
              {linesStatus === 'ready' && (
                <div className="journal-detail-grid">
                  <AgGridReact
                    theme={themeBalham}
                    columnDefs={columnDefs}
                    defaultColDef={DEFAULT_COL_DEF}
                    rowData={rows}
                    getRowId={(params) => String(params.data.id)}
                    onRowClicked={(event) => setSelectedLineId(event.data.id)}
                    overlayNoRowsTemplate="Aucune écriture."
                  />
                </div>
              )}
            </div>

            <div className="journal-detail-balance">
              {balanceStatus === 'loading' && <p className="muted">Chargement du solde…</p>}
              {balanceStatus === 'error' && (
                <p className="error">Échec du chargement du solde : {balanceError}</p>
              )}
              {balanceStatus === 'ready' && balance && (
                <>
                  <p className="journal-detail-balance-label">
                    {appliedParams.from || appliedParams.to
                      ? `Total du ${appliedParams.from || '…'} au ${appliedParams.to || '…'} (aucun autre filtre n'est pris en compte)`
                      : 'Total'}
                  </p>
                  <div className="journal-detail-balance-values">
                    <div className="journal-detail-balance-item">
                      <span className="journal-detail-balance-item-label">Débit total</span>
                      <span className="journal-detail-balance-item-value">
                        {formatAmount(balance.total_debit)}
                      </span>
                    </div>
                    <div className="journal-detail-balance-item">
                      <span className="journal-detail-balance-item-label">Crédit total</span>
                      <span className="journal-detail-balance-item-value">
                        {formatAmount(balance.total_credit)}
                      </span>
                    </div>
                    <div className="journal-detail-balance-item">
                      <span className="journal-detail-balance-item-label">Solde</span>
                      <span className="journal-detail-balance-item-value">
                        {formatAmount(balance.solde)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>

      <Popup
        open={isCreateJournalOpen}
        onClose={() => setIsCreateJournalOpen(false)}
        title="Créer un journal"
      >
        <CreateJournalPopup
          onClose={() => setIsCreateJournalOpen(false)}
          onCreated={handleJournalCreated}
        />
      </Popup>

      {selectedJournal && (
        <Popup open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modifier le journal">
          <EditJournalPopup
            journal={selectedJournal}
            onClose={() => setIsEditOpen(false)}
            onUpdated={handleJournalUpdated}
          />
        </Popup>
      )}

      {selectedJournal && (
        <Popup
          open={isCreateLineOpen}
          onClose={() => (createTransactionCloseRequest.current ?? closeCreateLinePopup)()}
          panelClassName="create-transaction-panel"
        >
          <CreateTransactionPopup
            journalId={selectedJournal.id}
            onClose={closeCreateLinePopup}
            onSaved={handleLineCreated}
            onDeleted={handleLineCreated}
            onRequestClose={(fn) => {
              createTransactionCloseRequest.current = fn
            }}
          />
        </Popup>
      )}

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

      <Popup open={selectedLineId !== null} onClose={() => setSelectedLineId(null)} title="Écriture">
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
