import { useEffect, useRef, useState } from 'react'
import { createJournalLine, getAccount, getJournals } from '../api/client'
import Popup from './Popup'
import AccountPickerPopup from './AccountPickerPopup'
import './CreateJournalLinePopup.css'

function makeEmptyForm(journalId) {
  return {
    journal_id: journalId ? String(journalId) : '',
    account_id: '',
    date: '',
    description: '',
    type: 'debit', // 'debit' | 'credit'
    amount: '',
  }
}

function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form, accountLookupStatus, requireJournalSelect) {
  const errors = {}

  if (requireJournalSelect && !form.journal_id) {
    errors.journal_id = 'journal est requis'
  }

  if (!form.account_id.trim()) {
    errors.account_id = 'account_id est requis'
  } else if (!/^\d+$/.test(form.account_id.trim())) {
    errors.account_id = 'account_id doit contenir uniquement des chiffres'
  } else if (accountLookupStatus === 'not-found') {
    errors.account_id = "Ce compte n'existe pas"
  }

  if (!form.date) errors.date = 'date est requise'
  if (!form.description.trim()) errors.description = 'description est requise'

  const amountNum = Number(form.amount)
  if (!form.amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
    errors.amount = 'Le montant doit être un nombre positif'
  }

  return errors
}

// Maps server-side field names (debit_amount/credit_amount) back onto our
// single `amount` field so validation errors surface next to the right input.
function mapServerField(field) {
  if (field === 'debit_amount' || field === 'credit_amount') return 'amount'
  return field
}

// Journal-line creation popup. When `journalId` is provided (e.g. from the
// journal detail page), the journal is fixed and not shown as a field. When
// omitted (e.g. the global /journal-lines page), a journal dropdown is shown
// instead so the user picks which journal the line belongs to.
export default function CreateJournalLinePopup({ journalId, onClose, onCreated }) {
  const requireJournalSelect = !journalId

  const [form, setForm] = useState(() => makeEmptyForm(journalId))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [journals, setJournals] = useState([])

  // 'idle' | 'loading' | 'found' | 'not-found'
  const [accountLookupStatus, setAccountLookupStatus] = useState('idle')
  const [accountName, setAccountName] = useState(null)
  const lookupSeq = useRef(0)

  const [isPickerOpen, setIsPickerOpen] = useState(false)

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

  // Live exact-id lookup against /api/accounts/:id, debounced.
  useEffect(() => {
    const accountId = form.account_id.trim()

    if (!accountId || accountId.length !== 10 || !/^\d+$/.test(accountId)) {
      setAccountLookupStatus('idle')
      setAccountName(null)
      return
    }

    const seq = ++lookupSeq.current
    setAccountLookupStatus('loading')

    const timeout = setTimeout(() => {
      getAccount(accountId)
        .then((data) => {
          if (lookupSeq.current !== seq) return
          setAccountName(data?.name ?? null)
          setAccountLookupStatus('found')
        })
        .catch(() => {
          if (lookupSeq.current !== seq) return
          setAccountName(null)
          setAccountLookupStatus('not-found')
        })
    }, 250)

    return () => clearTimeout(timeout)
  }, [form.account_id])

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleAccountSelected(account) {
    // Skip the round-trip lookup: we already have the full account from the picker.
    lookupSeq.current += 1
    setForm((f) => ({ ...f, account_id: account.id }))
    setAccountName(account.name)
    setAccountLookupStatus('found')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errors = clientValidate(form, accountLookupStatus, requireJournalSelect)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError(null)
      return
    }

    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      await createJournalLine({
        journal_id: Number(requireJournalSelect ? form.journal_id : journalId),
        account_id: form.account_id.trim(),
        date: form.date,
        description: form.description.trim(),
        debit_amount: form.type === 'debit' ? Number(form.amount) : null,
        credit_amount: form.type === 'credit' ? Number(form.amount) : null,
      })
      onCreated?.()
      onClose?.()
    } catch (err) {
      if (Array.isArray(err.details)) {
        const nextFieldErrors = {}
        const generalMessages = []
        for (const issue of err.details) {
          const field = mapServerField(fieldFromPath(issue.path))
          if (field && field in form) {
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

  return (
    <form className="create-journal-line-form" onSubmit={handleSubmit}>
      {requireJournalSelect && (
        <div className="form-field">
          <label htmlFor="cjl-journal-id">Journal</label>
          <select
            id="cjl-journal-id"
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
      )}

      <div className="form-field">
        <label htmlFor="cjl-account-id">Compte (id)</label>
        <div className="form-field-with-hint">
          <input
            id="cjl-account-id"
            type="text"
            value={form.account_id}
            onChange={(e) => updateField('account_id', e.target.value)}
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
        <AccountPickerPopup onSelect={handleAccountSelected} onClose={() => setIsPickerOpen(false)} />
      </Popup>

      <div className="form-field">
        <label htmlFor="cjl-date">Date</label>
        <input
          id="cjl-date"
          type="date"
          value={form.date}
          onChange={(e) => updateField('date', e.target.value)}
        />
        {fieldErrors.date && <p className="field-error">{fieldErrors.date}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="cjl-description">Description</label>
        <input
          id="cjl-description"
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
              name="cjl-type"
              value="debit"
              checked={form.type === 'debit'}
              onChange={() => updateField('type', 'debit')}
            />
            Débit
          </label>
          <label className="type-toggle-option">
            <input
              type="radio"
              name="cjl-type"
              value="credit"
              checked={form.type === 'credit'}
              onChange={() => updateField('type', 'credit')}
            />
            Crédit
          </label>
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="cjl-amount">Montant</label>
        <input
          id="cjl-amount"
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
        <button type="button" className="button" onClick={onClose} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer'}
        </button>
      </div>
    </form>
  )
}
