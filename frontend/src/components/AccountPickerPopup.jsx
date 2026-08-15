import { useEffect, useState } from 'react'
import { getAccounts } from '../api/client'
import Table from './Table'
import Popup from './Popup'
import CreateAccountPopup from '../pages/accounts/CreateAccountPopup'
import './AccountPickerPopup.css'

const COLUMNS = [
  { key: 'id', label: 'Code', sortable: true, width: 30 },
  { key: 'name', label: 'Nom', sortable: true },
]

// Generic account-selection popup: search by id/name, click a row to select.
// The "+" button opens account creation on top of this popup; on success the
// new account is prepended and the table's sort resets so it's visible at
// the top (the user can still sort normally afterward).
export default function AccountPickerPopup({ onSelect, onClose }) {
  const [search, setSearch] = useState({ id: '', name: '' })
  const [accounts, setAccounts] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  const [tableResetKey, setTableResetKey] = useState(0)

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setError(null)

    const params = {}
    if (search.id.trim()) params.id = search.id.trim()
    if (search.name.trim()) params.name = search.name.trim()

    getAccounts(params)
      .then((data) => {
        if (cancelled) return
        setAccounts(data)
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
  }, [search])

  function handleAccountCreated(account) {
    setAccounts((prev) => [account, ...prev.filter((a) => a.id !== account.id)])
    setTableResetKey((k) => k + 1)
  }

  return (
    <div className="account-picker">
      <div className="account-picker-search">
        <div className="account-picker-search-field">
          <label htmlFor="ap-search-id">Code</label>
          <input
            id="ap-search-id"
            type="text"
            value={search.id}
            onChange={(e) => setSearch((s) => ({ ...s, id: e.target.value }))}
            placeholder="4481"
            maxLength={10}
          />
        </div>
        <div className="account-picker-search-field">
          <label htmlFor="ap-search-name">Nom</label>
          <input
            id="ap-search-name"
            type="text"
            value={search.name}
            onChange={(e) => setSearch((s) => ({ ...s, name: e.target.value }))}
            placeholder="Fournisseurs"
          />
        </div>
        <button
          type="button"
          className="button account-picker-create"
          onClick={() => setIsCreateOpen(true)}
          aria-label="Créer un compte"
          title="Créer un compte"
        >
          +
        </button>
      </div>

      <div className="account-picker-table-container">
        {status === 'loading' && <p className="muted">Chargement…</p>}
        {status === 'error' && <p className="error">Échec du chargement des comptes : {error}</p>}
        {status === 'ready' && (
          <Table
            key={tableResetKey}
            columns={COLUMNS}
            data={accounts}
            emptyMessage="Aucun compte."
            onRowClick={(account) => {
              onSelect?.(account)
              onClose?.()
            }}
          />
        )}
      </div>

      <Popup
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Créer un compte"
      >
        <CreateAccountPopup
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleAccountCreated}
        />
      </Popup>
    </div>
  )
}
