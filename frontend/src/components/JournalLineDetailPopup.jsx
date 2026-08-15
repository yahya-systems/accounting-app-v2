import { useEffect, useState } from 'react'
import { getJournalLine, updateJournalLine } from '../api/client'
import { formatAmount } from '../utils/format'
import './JournalLineDetailPopup.css'

function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form) {
  const errors = {}
  if (!form.date) errors.date = 'date est requise'
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

// Universal read/edit popup for a single journal line. Fetches the richer
// GET /journal-lines/:id embed (account w/ pcg_reference_name, journal
// {id,name}) and, on edit, PATCHes date/description/debit/credit only —
// account_id and journal_id are not exposed as editable per the API spec.
export default function JournalLineDetailPopup({ lineId, onClose, onUpdated }) {
  const [line, setLine] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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
      date: line.date?.slice(0, 10) ?? '',
      description: line.description ?? '',
      type: isCredit ? 'credit' : 'debit',
      amount: String(isCredit ? line.credit_amount : line.debit_amount),
    })
    setFieldErrors({})
    setFormError(null)
    setIsEditing(true)
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errors = clientValidate(form)
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
          if (field === 'date' || field === 'description' || field === 'amount') {
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
          <label htmlFor="jl-date">Date</label>
          <input
            id="jl-date"
            type="date"
            value={form.date}
            onChange={(e) => updateField('date', e.target.value)}
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
          <dd>{line.date?.slice(0, 10)}</dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Description</dt>
          <dd>{line.description}</dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Compte</dt>
          <dd>
            {line.account?.id} — {line.account?.name}
            {line.account?.pcg_reference_name && (
              <span className="journal-line-detail-hint"> ({line.account.pcg_reference_name})</span>
            )}
          </dd>
        </div>
        <div className="journal-line-detail-row">
          <dt>Journal</dt>
          <dd>{line.journal?.name}</dd>
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
