import { useState } from 'react'
import './FilterBar.css'

function emptyStateFromSchema(schema) {
  return Object.fromEntries(schema.map((field) => [field.key, '']))
}

// Builds a query-param object from the current pending values: only fields
// with a non-empty value are included, keyed by each field's `param` name.
function buildParams(schema, values) {
  const params = {}
  for (const field of schema) {
    const value = values[field.key]
    if (value !== '' && value !== undefined && value !== null) {
      params[field.param] = value
    }
  }
  return params
}

function FilterField({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <div className="filter-bar-field">
        <label htmlFor={`filter-${field.key}`}>{field.label}</label>
        <select
          id={`filter-${field.key}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Tous</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="filter-bar-field">
      <label htmlFor={`filter-${field.key}`}>{field.label}</label>
      <input
        id={`filter-${field.key}`}
        type={field.type === 'date' ? 'date' : 'text'}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={field.maxLength}
      />
    </div>
  )
}

// Generic, schema-driven filter bar. `schema` is an array of field
// descriptors: { key, label, type: 'date' | 'text' | 'select', param, options?, placeholder? }.
// Owns its own pending state; calls `onApply(params)` with a ready-to-use
// query-param object (only non-empty fields included, keyed by `param`).
//
// Collapsed by default behind a "Rechercher" toggle so it doesn't clutter
// the page. Applying or clearing closes it back up; a dot on the toggle
// indicates filters are currently active while collapsed.
export default function FilterBar({ schema, onApply }) {
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState(() => emptyStateFromSchema(schema))
  const [hasActiveFilters, setHasActiveFilters] = useState(false)

  function updateField(key, value) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function handleApply() {
    const params = buildParams(schema, values)
    onApply(params)
    setHasActiveFilters(Object.keys(params).length > 0)
    setIsOpen(false)
  }

  function handleClear() {
    const empty = emptyStateFromSchema(schema)
    setValues(empty)
    onApply({})
    setHasActiveFilters(false)
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <div className="filter-bar filter-bar-collapsed">
        <button
          type="button"
          className={hasActiveFilters ? 'button filter-bar-toggle active' : 'button filter-bar-toggle'}
          onClick={() => setIsOpen(true)}
        >
          Rechercher
          {hasActiveFilters && <span className="filter-bar-active-dot" aria-label="Filtres actifs" />}
        </button>
        {hasActiveFilters && (
          <button type="button" className="button" onClick={handleClear}>
            Effacer
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="filter-bar">
      {schema.map((field) => (
        <FilterField
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(value) => updateField(field.key, value)}
        />
      ))}

      <div className="filter-bar-actions">
        <button type="button" className="button" onClick={handleApply}>
          Appliquer
        </button>
        <button type="button" className="button" onClick={handleClear}>
          Effacer
        </button>
        <button type="button" className="button" onClick={() => setIsOpen(false)}>
          Fermer
        </button>
      </div>
    </div>
  )
}
