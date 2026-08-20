import { useState } from 'react'
import { updateJournal } from '@api/client'
import { JOURNAL_TYPES } from '@pages/home/CreateJournalPopup'
import './EditJournalPopup.css'

function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'name est requis'
  if (!form.description.trim()) errors.description = 'description est requise'
  return errors
}

export default function EditJournalPopup({ journal, onClose, onUpdated }) {
  const [form, setForm] = useState({
    name: journal.name ?? '',
    description: journal.description ?? '',
    type: journal.type ?? 'Autre',
  })

  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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
      await updateJournal(journal.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
      })
      onUpdated?.()
      onClose?.()
    } catch (err) {
      if (Array.isArray(err.details)) {
        const nextFieldErrors = {}
        const generalMessages = []
        for (const issue of err.details) {
          const field = fieldFromPath(issue.path)
          if (field === 'name' || field === 'description' || field === 'type') {
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
    <form className="edit-journal-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="ej-name">Nom</label>
        <input
          id="ej-name"
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="ej-description">Description</label>
        <input
          id="ej-description"
          type="text"
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
        {fieldErrors.description && <p className="field-error">{fieldErrors.description}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="ej-type">Type</label>
        <select
          id="ej-type"
          value={form.type}
          onChange={(e) => updateField('type', e.target.value)}
        >
          {JOURNAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {fieldErrors.type && <p className="field-error">{fieldErrors.type}</p>}
      </div>

      {formError && <p className="error form-error">{formError}</p>}

      <div className="form-actions">
        <button type="button" className="button" onClick={onClose} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
