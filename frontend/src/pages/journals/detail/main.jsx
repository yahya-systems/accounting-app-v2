import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { themeBalham } from 'ag-grid-community'
import {
  getJournal,
  getJournalBalance,
  getJournalLines,
  updateJournal,
} from '@api/client'
import { formatAmount } from '@utils/format'
import Popup from '@components/Popup'
import FilterBar from '@components/FilterBar'
import JournalLineDetailPopup from '@components/JournalLineDetailPopup'
import CreateTransactionPopup from '@components/CreateTransactionPopup'
import EditJournalPopup from './EditJournalPopup'
import PencilIcon from '@components/PencilIcon'
import './JournalDetail.css'

// Cell renderer for the "Numéro PCG" / "Compte" columns: links straight to
// the account's detail page instead of falling through to the row click
// (which opens the line detail popup). stopPropagation is required so the
// row's onRowClicked doesn't also fire and open that popup underneath.
// (Read-only now — see Home's main.jsx for why inline edit mode was removed.)
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

  const [balance, setBalance] = useState(null)
  const [balanceStatus, setBalanceStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [balanceError, setBalanceError] = useState(null)

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

  useEffect(() => {
    let cancelled = false

    setBalanceStatus('loading')
    setBalanceError(null)

    const balanceParams = {}
    if (appliedParams.from) balanceParams.from = appliedParams.from
    if (appliedParams.to) balanceParams.to = appliedParams.to

    getJournalBalance(id, balanceParams)
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

  const columnDefs = useMemo(() => buildColumnDefs(), [])

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
              <span className="badge">{journal.type}</span>
              <span className="badge">{journal.is_active ? 'Actif' : 'Inactif'}</span>
            </div>
            <div className="journal-detail-info-actions">
              <button
                type="button"
                className="button icon-button"
                onClick={() => setIsEditOpen(true)}
                aria-label="Modifier le journal"
                title="Modifier le journal"
              >
                <PencilIcon />
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
        panelClassName="create-transaction-panel"
      >
        <CreateTransactionPopup
          journalId={Number(id)}
          onClose={() => setIsCreateLineOpen(false)}
          onSaved={handleLineCreated}
          onDeleted={handleLineCreated}
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
