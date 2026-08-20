import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getJournalLine } from '@api/client'
import { formatAmount } from '@utils/format'
import './JournalLineDetailPopup.css'

// Read-only detail popup for a single posted journal line. Fetches the
// richer GET /journal-lines/:id embed (account w/ pcg_reference_name,
// journal {id,name}, transaction {id,name}).
//
// Editing was removed here during the transactions refactor: PATCH
// /journal-lines/:id no longer exists on the backend (see mem:api_endpoints
// in the backend project) — once a transaction is posted, its lines are
// frozen; there is no atomic "replace lines on a posted transaction" flow
// built yet. Line-draft editing (pre-post) happens in CreateTransactionPopup
// instead. Re-introducing edit here is future work, once the backend gains
// a posted-line-edit endpoint.
export default function JournalLineDetailPopup({ lineId, onClose }) {
  const [line, setLine] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)

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

  if (status === 'loading') return <p className="muted">Chargement…</p>
  if (status === 'error') return <p className="error">Échec du chargement de l'écriture : {error}</p>
  if (!line) return null

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
          <dt>Transaction</dt>
          <dd>{line.transaction?.name ?? line.transaction?.id}</dd>
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
      </div>
    </div>
  )
}
