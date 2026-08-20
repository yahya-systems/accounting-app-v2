import { useEffect, useRef, useState } from 'react'
import { createAccount, getPcgReference } from '@api/client'
import './CreateAccountPopup.css'

const EMPTY_FORM = {
  pcg_code: '',
  name: '',
  description: '',
}

// Maps a Zod issue `path` (e.g. ["pcg_code"]) to our field keys.
function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form, metadataRows) {
  const errors = {}

  if (!form.pcg_code.trim()) {
    errors.pcg_code = 'pcg_code est requis'
  } else if (!/^\d+$/.test(form.pcg_code.trim())) {
    errors.pcg_code = 'pcg_code doit contenir uniquement des chiffres'
  }

  if (!form.name.trim()) {
    errors.name = 'name est requis'
  }

  if (!form.description.trim()) {
    errors.description = 'description est requise'
  }

  const seenKeys = new Set()
  for (const row of metadataRows) {
    if (!row.key.trim()) continue
    if (seenKeys.has(row.key.trim())) {
      errors.metadata = 'Les clés de métadonnées doivent être uniques'
    }
    seenKeys.add(row.key.trim())
  }

  return errors
}

function buildMetadata(metadataRows) {
  const metadata = {}
  for (const row of metadataRows) {
    const key = row.key.trim()
    if (!key) continue
    metadata[key] = row.value
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

export default function CreateAccountPopup({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [metadataRows, setMetadataRows] = useState([])
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [pcgLabel, setPcgLabel] = useState(null) // pcg_reference_name preview, or null
  const lookupSeq = useRef(0)

  // Live prefix lookup against /api/pcg-reference/:code, debounced.
  useEffect(() => {
    const code = form.pcg_code.trim()

    if (!code || code.length > 10 || !/^\d+$/.test(code)) {
      setPcgLabel(null)
      return
    }

    const seq = ++lookupSeq.current
    const timeout = setTimeout(() => {
      getPcgReference(code)
        .then((data) => {
          if (lookupSeq.current !== seq) return
          setPcgLabel(data?.name ?? null)
        })
        .catch(() => {
          if (lookupSeq.current !== seq) return
          setPcgLabel(null)
        })
    }, 250)

    return () => clearTimeout(timeout)
  }, [form.pcg_code])

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function addMetadataRow() {
    setMetadataRows((rows) => [...rows, { key: '', value: '' }])
  }

  function updateMetadataRow(index, patch) {
    setMetadataRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeMetadataRow(index) {
    setMetadataRows((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errors = clientValidate(form, metadataRows)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError(null)
      return
    }

    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const account = await createAccount({
        pcg_code: form.pcg_code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        metadata: buildMetadata(metadataRows),
      })
      onCreated?.(account)
      onClose?.()
    } catch (err) {
      if (Array.isArray(err.details)) {
        const nextFieldErrors = {}
        const generalMessages = []
        for (const issue of err.details) {
          const field = fieldFromPath(issue.path)
          if (field && field in EMPTY_FORM) {
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
    <form className="create-account-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="ca-pcg-code">Code PCG</label>
        <div className="form-field-with-hint">
          <input
            id="ca-pcg-code"
            type="text"
            value={form.pcg_code}
            onChange={(e) => updateField('pcg_code', e.target.value)}
            placeholder="4481000000"
            maxLength={10}
          />
          {pcgLabel && <span className="form-field-hint">{pcgLabel}</span>}
        </div>
        {fieldErrors.pcg_code && <p className="field-error">{fieldErrors.pcg_code}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="ca-name">Nom</label>
        <input
          id="ca-name"
          type="text"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
      </div>

      <div className="form-field">
        <label htmlFor="ca-description">Description</label>
        <input
          id="ca-description"
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
          {submitting ? 'Création…' : 'Créer'}
        </button>
      </div>
    </form>
  )
}
