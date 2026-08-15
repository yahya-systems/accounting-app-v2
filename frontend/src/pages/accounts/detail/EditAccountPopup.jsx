import { useState } from 'react'
import { updateAccount } from '../../../api/client'
import './EditAccountPopup.css'

// Metadata rows carry an `original` flag so we know, on removal, whether we
// need to send an explicit null (server shallow-merges: null deletes the key,
// omitted keys are left untouched) or can just drop a never-saved row.
function metadataToRows(metadata) {
  return Object.entries(metadata ?? {}).map(([key, value]) => ({
    key,
    value: String(value),
    original: true,
  }))
}

function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'name est requis'
  if (!form.description.trim()) errors.description = 'description est requise'
  return errors
}

// Builds the metadata patch: current rows set/overwrite their key, and any
// originally-present key that's no longer in the rows is sent as null (delete).
function buildMetadataPatch(rows, removedOriginalKeys) {
  const metadata = {}
  const seenKeys = new Set()

  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    metadata[key] = row.value
    seenKeys.add(key)
  }

  for (const key of removedOriginalKeys) {
    if (!seenKeys.has(key)) metadata[key] = null
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

export default function EditAccountPopup({ account, onClose, onUpdated }) {
  const [form, setForm] = useState({
    name: account.name ?? '',
    description: account.description ?? '',
  })
  const [metadataRows, setMetadataRows] = useState(() => metadataToRows(account.metadata))
  const [removedOriginalKeys, setRemovedOriginalKeys] = useState([])

  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function addMetadataRow() {
    setMetadataRows((rows) => [...rows, { key: '', value: '', original: false }])
  }

  function updateMetadataRow(index, patch) {
    setMetadataRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeMetadataRow(index) {
    setMetadataRows((rows) => {
      const row = rows[index]
      if (row.original) {
        setRemovedOriginalKeys((keys) => [...keys, row.key])
      }
      return rows.filter((_, i) => i !== index)
    })
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
      await updateAccount(account.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        metadata: buildMetadataPatch(metadataRows, removedOriginalKeys),
      })
      onUpdated?.()
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
    <form className="edit-account-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="ea-name">Nom</label>
        <input
          id="ea-name"
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="ea-description">Description</label>
        <input
          id="ea-description"
          type="text"
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
        />
        {fieldErrors.description && <p className="field-error">{fieldErrors.description}</p>}
      </div>

      <div className="form-field">
        <div className="metadata-header">
          <label>Métadonnées</label>
          <button type="button" className="button" onClick={addMetadataRow}>
            Ajouter une clé
          </button>
        </div>

        {metadataRows.map((row, index) => (
          <div className="metadata-row" key={index}>
            <input
              type="text"
              placeholder="Clé"
              value={row.key}
              disabled={row.original}
              onChange={(e) => updateMetadataRow(index, { key: e.target.value })}
            />
            <input
              type="text"
              placeholder="Valeur"
              value={row.value}
              onChange={(e) => updateMetadataRow(index, { value: e.target.value })}
            />
            <button
              type="button"
              className="metadata-remove"
              onClick={() => removeMetadataRow(index)}
              aria-label="Supprimer"
            >
              ×
            </button>
          </div>
        ))}
        {fieldErrors.metadata && <p className="field-error">{fieldErrors.metadata}</p>}
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
