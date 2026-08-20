import { useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { themeBalham } from 'ag-grid-community'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  updateLineDraft,
  deleteLineDraft,
  getTransactionBalance,
  postTransaction,
  getJournals,
} from '@api/client'
import { formatAmount, dayMonthToDateInputValue, dateInputValueToDayMonth } from '@utils/format'
import Popup from './Popup'
import CreateJournalLinePopup from './CreateJournalLinePopup'
import TrashIcon from './TrashIcon'
import './CreateTransactionPopup.css'

function todayAsDayMonth() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

// AG Grid's editors commit values as strings; the API expects
// debit_amount/credit_amount as numbers (same helper used by the
// Home/JournalDetail grids).
function toAmountOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

function DeleteLineCell({ data, onDelete }) {
  return (
    <button
      type="button"
      className="button icon-button create-transaction-delete-line"
      onClick={() => onDelete(data)}
      aria-label="Supprimer la ligne"
      title="Supprimer la ligne"
    >
      <TrashIcon />
    </button>
  )
}

function buildColumnDefs({ onDeleteLine }) {
  return [
    {
      field: 'account_pcg_code',
      headerName: 'Numéro PCG',
      flex: 1.1,
      editable: false,
    },
    {
      field: 'account_name',
      headerName: 'Compte',
      flex: 1.6,
      editable: false,
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      editable: true,
    },
    {
      field: 'debit_amount',
      headerName: 'Débit',
      type: 'rightAligned',
      cellDataType: 'number',
      valueFormatter: (params) => formatAmount(params.value),
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2, min: 0 },
      flex: 1.1,
    },
    {
      field: 'credit_amount',
      headerName: 'Crédit',
      type: 'rightAligned',
      cellDataType: 'number',
      valueFormatter: (params) => formatAmount(params.value),
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 2, min: 0 },
      flex: 1.1,
    },
    {
      headerName: '',
      colId: 'delete',
      width: 44,
      editable: false,
      sortable: false,
      resizable: false,
      cellRenderer: DeleteLineCell,
      cellRendererParams: { onDelete: onDeleteLine },
    },
  ]
}

const DEFAULT_COL_DEF = {
  editable: false,
  resizable: true,
}

// The big "create a transaction" popup. A draft transaction is created via
// POST /transactions the moment this component mounts (immediately on
// open, per product decision) — journal_id/date/name are all optional on
// that call, so this never blocks on user input. date defaults to today,
// name defaults to "#<id>" once the id comes back (both set via a
// follow-up PATCH, since the id isn't known until after creation).
//
// journalId fixes the journal (e.g. opened from /journals/:id or Home) and
// hides the journal dropdown; when omitted (the journal-less /journal-lines
// page), a dropdown is shown and defaults to the first journal returned by
// GET /journals (order doesn't matter).
export default function CreateTransactionPopup({ journalId, onClose, onSaved, onDeleted, onRequestClose }) {
  const [transaction, setTransaction] = useState(null)
  const [initStatus, setInitStatus] = useState('creating') // 'creating' | 'ready' | 'error'
  const [initError, setInitError] = useState(null)

  const [journals, setJournals] = useState([])
  const requireJournalSelect = !journalId

  const [date, setDate] = useState(todayAsDayMonth())
  const [name, setName] = useState('')

  const [lineDrafts, setLineDrafts] = useState([])

  const [balance, setBalance] = useState(null)
  const [balanceStatus, setBalanceStatus] = useState('idle') // 'idle' | 'loading' | 'error' | 'ready'

  const [isCreateLineOpen, setIsCreateLineOpen] = useState(false)
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false)
  const [closeStatus, setCloseStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [closeError, setCloseError] = useState(null)

  const [postStatus, setPostStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [postError, setPostError] = useState(null)

  const [lineError, setLineError] = useState(null)

  const selectedJournalId = journalId ?? transaction?.journal_id ?? journals[0]?.id ?? null
  const selectedJournalType = journals.find((j) => j.id === selectedJournalId)?.type

  // Journal-less mode needs the list to populate the dropdown and to derive
  // the default (first) journal for the immediate creation call.
  useEffect(() => {
    if (!requireJournalSelect) return
    let cancelled = false
    getJournals()
      .then((data) => {
        if (cancelled) return
        setJournals(data)
      })
      .catch(() => {
        if (cancelled) return
        setJournals([])
      })
    return () => {
      cancelled = true
    }
  }, [requireJournalSelect])

  // Create the draft transaction immediately on open. In journal-less mode
  // this waits for the journals list so a journal_id can be sent (option A:
  // default to the first journal in the list; the user can change it after,
  // which PATCHes journal_id).
  useEffect(() => {
    if (requireJournalSelect && journals.length === 0) return
    let cancelled = false

    const initialJournalId = journalId ?? journals[0]?.id
    const initialDate = todayAsDayMonth()

    createTransaction({ journal_id: initialJournalId, date: initialDate })
      .then(async (created) => {
        if (cancelled) return
        const defaultName = `#${created.id}`
        await updateTransaction(created.id, { name: defaultName })
        if (cancelled) return
        setTransaction({ ...created, name: defaultName })
        setDate(initialDate)
        setName(defaultName)
        setInitStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setInitError(err.message)
        setInitStatus('error')
      })

    return () => {
      cancelled = true
    }
    // Intentionally runs once (guarded by initStatus never resetting) — the
    // journals-list dependency only exists to defer until the default
    // journal is knowable in journal-less mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requireJournalSelect, journals.length === 0])

  const refreshBalance = useMemo(
    () => async (transactionId) => {
      setBalanceStatus('loading')
      try {
        const data = await getTransactionBalance(transactionId)
        setBalance(data)
        setBalanceStatus('ready')
      } catch {
        setBalanceStatus('error')
      }
    },
    [],
  )

  useEffect(() => {
    if (!transaction) return
    refreshBalance(transaction.id)
  }, [transaction, refreshBalance, lineDrafts])

  async function handleDateChange(value) {
    const dayMonth = dateInputValueToDayMonth(value)
    if (!dayMonth) return
    setDate(dayMonth)
    if (!transaction) return
    try {
      await updateTransaction(transaction.id, { date: dayMonth })
    } catch (err) {
      setLineError(err.message)
    }
  }

  async function handleNameBlur() {
    if (!transaction) return
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await updateTransaction(transaction.id, { name: trimmed })
    } catch (err) {
      setLineError(err.message)
    }
  }

  async function handleJournalChange(value) {
    if (!transaction) return
    const nextJournalId = Number(value)
    try {
      await updateTransaction(transaction.id, { journal_id: nextJournalId })
      setTransaction((t) => ({ ...t, journal_id: nextJournalId }))
    } catch (err) {
      setLineError(err.message)
    }
  }

  function handleLinesCreated(createdLines) {
    setLineDrafts((prev) => [...prev, ...createdLines])
  }

  async function handleCellValueChanged(event) {
    if (!transaction) return
    const field = event.colDef.field
    let patch = null
    if (field === 'debit_amount') {
      patch = { debit_amount: toAmountOrNull(event.newValue), credit_amount: null }
    } else if (field === 'credit_amount') {
      patch = { debit_amount: null, credit_amount: toAmountOrNull(event.newValue) }
    } else if (field === 'description') {
      patch = { description: event.newValue }
    }
    if (!patch) return

    try {
      const updated = await updateLineDraft(transaction.id, event.data.id, patch)
      setLineDrafts((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      setLineError(null)
    } catch (err) {
      setLineError(err.message)
      // Refetch isn't available (no GET-all-drafts-for-transaction endpoint
      // beyond the transaction detail fetch); revert the local row instead.
      setLineDrafts((prev) => [...prev])
    }
  }

  async function handleDeleteLine(line) {
    if (!transaction) return
    try {
      await deleteLineDraft(transaction.id, line.id)
      setLineDrafts((prev) => prev.filter((l) => l.id !== line.id))
      setLineError(null)
    } catch (err) {
      setLineError(err.message)
    }
  }

  function requestClose() {
    setCloseError(null)
    setIsCloseConfirmOpen(true)
  }

  // Hands the parent's <Popup onClose> our own requestClose, so Esc and
  // overlay-click (which Popup.jsx wires straight to onClose) also open the
  // save-draft/delete confirmation instead of closing outright — the same
  // path the in-header × button already uses.
  useEffect(() => {
    onRequestClose?.(() => requestClose)
  }, [onRequestClose])

  function handleSaveAsDraft() {
    // Already a draft the moment it was created — nothing more to persist,
    // every field edit up to this point was already saved via PATCH.
    setIsCloseConfirmOpen(false)
    onSaved?.(transaction)
    onClose?.()
  }

  async function handleDeleteTransaction() {
    if (!transaction) return
    setCloseStatus('working')
    setCloseError(null)
    try {
      await deleteTransaction(transaction.id)
      setCloseStatus('idle')
      setIsCloseConfirmOpen(false)
      onDeleted?.(transaction)
      onClose?.()
    } catch (err) {
      setCloseError(err.message)
      setCloseStatus('error')
    }
  }

  async function handlePost() {
    if (!transaction) return
    setPostStatus('working')
    setPostError(null)
    try {
      const posted = await postTransaction(transaction.id)
      setPostStatus('idle')
      onSaved?.(posted)
      onClose?.()
    } catch (err) {
      setPostError(err.message)
      setPostStatus('error')
    }
  }

  const rows = lineDrafts.map((line) => ({
    ...line,
    account_pcg_code: line.account?.id ?? null,
    account_name: line.account?.name ?? null,
  }))

  const columnDefs = useMemo(() => buildColumnDefs({ onDeleteLine: handleDeleteLine }), [transaction])

  const sold = balance ? Number(balance.sold) : null
  const canPost = transaction && sold !== null && sold === 0 && rows.length > 0

  return (
    <div className="create-transaction-popup">
      {initStatus === 'creating' && <p className="muted">Création de la transaction…</p>}
      {initStatus === 'error' && (
        <p className="error">Échec de la création de la transaction : {initError}</p>
      )}

      {initStatus === 'ready' && transaction && (
        <>
          <div className="create-transaction-header">
            <h2>Transaction #{transaction.id}</h2>
            <button
              type="button"
              className="popup-close create-transaction-close"
              onClick={requestClose}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          <div className="create-transaction-fields">
            {requireJournalSelect && (
              <div className="form-field">
                <label htmlFor="ct-journal">Journal</label>
                <select
                  id="ct-journal"
                  value={selectedJournalId ?? ''}
                  onChange={(e) => handleJournalChange(e.target.value)}
                >
                  {journals.map((journal) => (
                    <option key={journal.id} value={journal.id}>
                      {journal.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-field">
              <label htmlFor="ct-date">Date</label>
              <input
                id="ct-date"
                type="date"
                min={`${new Date().getFullYear()}-01-01`}
                max={`${new Date().getFullYear()}-12-31`}
                value={dayMonthToDateInputValue(date)}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="ct-name">Nom</label>
              <input
                id="ct-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
              />
            </div>
          </div>

          {lineError && <p className="error">Échec de la modification : {lineError}</p>}

          <div className="create-transaction-lines-header">
            <h3>Lignes</h3>
            <button
              type="button"
              className="button icon-button"
              onClick={() => setIsCreateLineOpen(true)}
              aria-label="Ajouter une ligne"
              title="Ajouter une ligne"
            >
              +
            </button>
          </div>

          <div className="create-transaction-grid">
            <AgGridReact
              theme={themeBalham}
              columnDefs={columnDefs}
              defaultColDef={DEFAULT_COL_DEF}
              rowData={rows}
              getRowId={(params) => String(params.data.id)}
              onCellValueChanged={handleCellValueChanged}
              overlayNoRowsTemplate="Aucune ligne."
              domLayout="autoHeight"
            />
          </div>

          <div className="create-transaction-totals">
            <div className="create-transaction-totals-item">
              <span className="create-transaction-totals-label">Débit total</span>
              <span className="create-transaction-totals-value">
                {balance ? formatAmount(balance.total_debit) : '—'}
              </span>
            </div>
            <div className="create-transaction-totals-item">
              <span className="create-transaction-totals-label">Crédit total</span>
              <span className="create-transaction-totals-value">
                {balance ? formatAmount(balance.total_credit) : '—'}
              </span>
            </div>
            <div className="create-transaction-totals-item">
              <span className="create-transaction-totals-label">Solde</span>
              <span className="create-transaction-totals-value">
                {balance ? formatAmount(balance.sold) : '—'}
              </span>
            </div>
          </div>

          {postError && <p className="error">Échec de la validation : {postError}</p>}

          <div className="form-actions">
            <button type="button" className="button" onClick={handleSaveAsDraft}>
              Enregistrer comme brouillon
            </button>
            <button
              type="button"
              className="button"
              onClick={handlePost}
              disabled={!canPost || postStatus === 'working'}
              title={!canPost ? 'Le solde doit être à zéro pour valider' : undefined}
            >
              {postStatus === 'working' ? 'Validation…' : 'Valider'}
            </button>
          </div>

          <Popup
            open={isCreateLineOpen}
            onClose={() => setIsCreateLineOpen(false)}
            title="Ajouter une ligne"
          >
            <CreateJournalLinePopup
              transactionId={transaction.id}
              journalId={selectedJournalId}
              journalType={selectedJournalType}
              onClose={() => setIsCreateLineOpen(false)}
              onCreated={handleLinesCreated}
            />
          </Popup>

          <Popup
            open={isCloseConfirmOpen}
            onClose={() => setIsCloseConfirmOpen(false)}
            title="Fermer la transaction"
          >
            <div className="deactivate-confirm">
              <p>Voulez-vous enregistrer cette transaction comme brouillon ou la supprimer ?</p>
              {closeStatus === 'error' && <p className="error">{closeError}</p>}
              <div className="form-actions">
                <button
                  type="button"
                  className="button"
                  onClick={handleDeleteTransaction}
                  disabled={closeStatus === 'working'}
                >
                  {closeStatus === 'working' ? 'Suppression…' : 'Supprimer'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={handleSaveAsDraft}
                  disabled={closeStatus === 'working'}
                >
                  Enregistrer comme brouillon
                </button>
              </div>
            </div>
          </Popup>
        </>
      )}
    </div>
  )
}
