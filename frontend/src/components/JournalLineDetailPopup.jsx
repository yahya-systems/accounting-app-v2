import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJournalLine, updateJournalLine, getAccount, getJournals } from '../api/client'
import {
  formatAmount,
  fullDateToDayMonth,
  dayMonthToDateInputValue,
  dateInputValueToDayMonth,
} from '../utils/format'
import Popup from './Popup'
import AccountPickerPopup from './AccountPickerPopup'
import './JournalLineDetailPopup.css'

const currentYear = new Date().getFullYear()

function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form, accountLookupStatus) {
  const errors = {}

  if (!form.journal_id) {
    errors.journal_id = 'journal est requis'
  }

  if (!form.account_id.trim()) {
    errors.account_id = 'account_id est requis'
  } else if (!/^\d+$/.test(form.account_id.trim())) {
    errors.account_id = 'account_id doit contenir uniquement des chiffres'
  } else if (accountLookupStatus === 'not-found') {
    errors.account_id = "Ce compte n'existe pas"
  }

  if (!form.date) {
    errors.date = 'date est requise'
  } else if (!/^\d{2}-\d{2}$/.test(form.date)) {
    errors.date = 'date must be in MM-DD format'
  }
  if (!form.description.trim()) errors.description = 'description est requise'

  const amountNum = Number(form.amount)
  if (!form.amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
    errors.amount = 'Le montant doit être un nombre positif'
  }

  return errors
}

function mapServerField(field) {
  if (field === 'debit_amount' || field === 'credit_amount') return 'amount'
  return field
}

// Hook: live exact-id lookup against /api/accounts/:id, debounced. Returns
// [status, name] where status is 'idle' | 'loading' | 'found' | 'not-found'.
// (Mirrors CreateJournalLinePopup's useAccountLookup.)
function useAccountLookup(accountId) {
  const [status, setStatus] = useState('idle')
  const [name, setName] = useState(null)
  const seqRef = useRef(0)

  useEffect(() => {
    const trimmed = accountId.trim()

    if (!trimmed || trimmed.length !== 10 || !/^\d+$/.test(trimmed)) {
      setStatus('idle')
      setName(null)
      return
    }

    const seq = ++seqRef.current
    setStatus('loading')

    const timeout = setTimeout(() => {
      getAccount(trimmed)
        .then((data) => {
          if (seqRef.current !== seq) return
          setName(data?.name ?? null)
          setStatus('found')
        })
        .catch(() => {
          if (seqRef.current !== seq) return
          setName(null)
          setStatus('not-found')
        })
    }, 250)

    return () => clearTimeout(timeout)
  }, [accountId])

  return [status, name, setStatus, setName, seqRef]
}

// Universal read/edit popup for a single journal line. Fetches the richer
// GET /journal-lines/:id embed (account w/ pcg_reference_name, journal
// {id,name}) and, on edit, PATCHes journal_id/account_id/date/description/
// debit/credit — the full body the API accepts.
export default function JournalLineDetailPopup({ lineId, onClose, onUpdated }) {
  const [line, setLine] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [journals, setJournals] = useState([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const [accountLookupStatus, accountName, setAccountLookupStatus, setAccountName, accountLookupSeq] =
    useAccountLookup(form?.account_id ?? '')

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setError(null)

    getJournalLine(lineId)
      .then((data) => {
        if (cancelled) return
        setLine(data)
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
  }, [lineId])

  function startEditing() {
    const isCredit = line.credit_amount !== null && line.credit_amount !== undefined
    setForm({
      journal_id: line.journal?.id ? String(line.journal.id) : '',
      account_id: line.account?.id ?? '',
      date: fullDateToDayMonth(line.date),
      description: line.description ?? '',
      type: isCredit ? 'credit' : 'debit',
      amount: String(isCredit ? line.credit_amount : line.debit_amount),
    })
    setAccountLookupStatus('found')
    setAccountName(line.account?.name ?? null)
    setFieldErrors({})
    setFormError(null)
    setIsEditing(true)
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleAccountSelected(account) {
    // Skip the round-trip lookup: we already have the full account from the picker.
    accountLookupSeq.current += 1
    setForm((f) => ({ ...f, account_id: account.id }))
    setAccountName(account.name)
    setAccountLookupStatus('found')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errors = clientValidate(form, accountLookupStatus)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError(null)
      return
    }

    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const updated = await updateJournalLine(lineId, {
        journal_id: Number(form.journal_id),
        account_id: form.account_id.trim(),
        date: form.date,
        description: form.description.trim(),
        debit_amount: form.type === 'debit' ? Number(form.amount) : null,
        credit_amount: form.type === 'credit' ? Number(form.amount) : null,
      })
      setLine((prev) => ({ ...prev, ...updated }))
      setIsEditing(false)
      onUpdated?.()
    } catch (err) {
      if (Array.isArray(err.details)) {
        const nextFieldErrors = {}
        const generalMessages = []
        for (const issue of err.details) {
          const field = mapServerField(fieldFromPath(issue.path))
          if (field === 'journal_id' || field === 'account_id' || field === 'date' || field === 'description' || field === 'amount') {
            nextFieldErrors[field] = issue.message
          } else {
            generalMessages.push(issue.message)
          }
        }
        setFieldErrors(nextFieldErrors)
        setFormError(generalMessages.join(' ') || null)
      } else {
        setFormError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') return <p className="muted">Chargement…</p>
  if (status === 'error') return <p className="error">Échec du chargement de l'écriture : {error}</p>
  if (!line) return null

  if (isEditing) {
    return (
      <form className="journal-line-detail-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="jl-journal-id">Journal</label>
          <select
            id="jl-journal-id"
            value={form.journal_id}
            onChange={(e) => updateField('journal_id', e.target.value)}
          >
            <option value="">Sélectionner…</option>
            {journals.map((journal) => (
              <option key={journal.id} value={journal.id}>
                {journal.name}
              </option>
            ))}
          </select>
          {fieldErrors.journal_id && <p className="field-error">{fieldErrors.journal_id}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="jl-account-id">Compte</label>
          <div className="form-field-with-hint">
            <input
              id="jl-account-id"
              type="text"
              value={form.account_id}
              onChange={(e) => updateField('account_id', e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                setIsPickerOpen(true)
              }}
              placeholder="4481000000"
              maxLength={10}
            />
            <button type="button" className="button" onClick={() => setIsPickerOpen(true)}>
              Choisir…
            </button>
            {accountLookupStatus === 'found' && (
              <span className="form-field-hint">{accountName}</span>
            )}
            {accountLookupStatus === 'not-found' && (
              <span className="form-field-hint form-field-hint-error">Ce compte n'existe pas</span>
            )}
          </div>
          {fieldErrors.account_id && <p className="field-error">{fieldErrors.account_id}</p>}
        </div>

        <Popup open={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Choisir un compte">
          <AccountPickerPopup
            key={isPickerOpen ? form.account_id : 'closed'}
            onSelect={handleAccountSelected}
            onClose={() => setIsPickerOpen(false)}
            initialCode={form.account_id.trim()}
          />
        </Popup>

        <div className="form-field">
          <label htmlFor="jl-date">Date (MM-JJ)</label>
          <input
            id="jl-date"
            type="date"
            min={`${currentYear}-01-01`}
            max={`${currentYear}-12-31`}
            value={dayMonthToDateInputValue(form.date)}
            onChange={(e) => updateField('date', dateInputValueToDayMonth(e.target.value))}
          />
          {fieldErrors.date && <p className="field-error">{fieldErrors.date}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="jl-description">Description</label>
          <input
            id="jl-description"
            type="text"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
          />
          {fieldErrors.description && <p className="field-error">{fieldErrors.description}</p>}
        </div>

        <div className="form-field">
          <label>Type</label>
          <div className="type-toggle">
            <label className="type-toggle-option">
              <input
                type="radio"
                name="jl-type"
                value="debit"
                checked={form.type === 'debit'}
                onChange={() => updateField('type', 'debit')}
              />
              Débit
            </label>
            <label className="type-toggle-option">
              <input
                type="radio"
                name="jl-type"
                value="credit"
                checked={form.type === 'credit'}
                onChange={() => updateField('type', 'credit')}
              />
              Crédit
            </label>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="jl-amount">Montant</label>
          <input
            id="jl-amount"
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => updateField('amount', e.target.value)}
          />
          {fieldErrors.amount && <p className="field-error">{fieldErrors.amount}</p>}
        </div>

        {formError && <p className="error form-error">{formError}</p>}

        <div className="form-actions">
          <button
            type="button"
            className="button"
            onClick={() => setIsEditing(false)}
            disabled={submitting}
          >
            Annuler
          </button>
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="journal-line-detail">
      <dl className="journal-line-detail-fields">
        <div className="journal-line-detail-row">
          <dt>Date</dt>
          <dd>{line.date}</dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Description</dt>
          <dd>{line.description}</dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Compte</dt>
          <dd>
            {line.account?.id ? (
              <Link to={`/accounts/${line.account.id}`} onClick={onClose}>
                {line.account.id} — {line.account.name}
              </Link>
            ) : (
              <>
                {line.account?.id} — {line.account?.name}
              </>
            )}
            {line.account?.pcg_reference_name && (
              <span className="journal-line-detail-hint"> ({line.account.pcg_reference_name})</span>
            )}
          </dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Journal</dt>
          <dd>
            {line.journal?.id ? (
              <Link to={`/journals/${line.journal.id}`} onClick={onClose}>
                {line.journal.name}
              </Link>
            ) : (
              line.journal?.name
            )}
          </dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Débit</dt>
          <dd>{formatAmount(line.debit_amount)}</dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Crédit</dt>
          <dd>{formatAmount(line.credit_amount)}</dd>
        </div>
      </dl>

      <div className="form-actions">
        <button type="button" className="button" onClick={onClose}>
          Fermer
        </button>
        <button type="button" className="button" onClick={startEditing}>
          Modifier
        </button>
      </div>
    </div>
  )
}
