import { useState } from 'react'
import { createJournal } from '../../api/client'
import './CreateJournalPopup.css'

const EMPTY_FORM = { name: '', description: '' }

function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'name est requis'
  if (!form.description.trim()) errors.description = 'description est requise'
  return errors
}

export default function CreateJournalPopup({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
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
      await createJournal({
        name: form.name.trim(),
        description: form.description.trim(),
      })
      onCreated?.()
      onClose?.()
    } catch (err) {
      if (Array.isArray(err.details)) {
        const nextFieldErrors = {}
        const generalMessages = []
        for (const issue of err.details) {
          const field = fieldFromPath(issue.path)
          if (field === 'name' || field === 'description') {
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
    <form className="create-journal-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="cj-name">Nom</label>
        <input
          id="cj-name"
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="cj-description">Description</label>
        <input
          id="cj-description"
          type="text"
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
        {fieldErrors.description && <p className="field-error">{fieldErrors.description}</p>}
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
