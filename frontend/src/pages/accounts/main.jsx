import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAccounts, getAccountBalance } from '../../api/client'
import { formatAmount } from '../../utils/format'
import Table from '../../components/Table'
import Popup from '../../components/Popup'
import FilterBar from '../../components/FilterBar'
import CreateAccountPopup from './CreateAccountPopup'
import './Accounts.css'

const FILTER_SCHEMA = [
  { key: 'id', label: 'Identifiant', type: 'text', param: 'id', placeholder: '4481' },
  { key: 'name', label: 'Nom', type: 'text', param: 'name', placeholder: 'Fournisseurs' },
  {
    key: 'isActive',
    label: 'Statut',
    type: 'select',
    param: 'is_active',
    options: [
      { value: 'true', label: 'Actif' },
      { value: 'false', label: 'Inactif' },
    ],
  },
  { key: 'createdAfter', label: 'Créé après', type: 'date', param: 'created_after' },
  { key: 'createdBefore', label: 'Créé avant', type: 'date', param: 'created_before' },
]

const COLUMNS = [
  { key: 'name', label: 'Nom', sortable: true },
  { key: 'id', label: 'Identifiant', sortable: true, width: 14 },
  {
    key: 'total_debit',
    label: 'Débit',
    sortable: true,
    align: 'right',
    width: 14,
    render: formatAmount,
  },
  {
    key: 'total_credit',
    label: 'Crédit',
    sortable: true,
    align: 'right',
    width: 14,
    render: formatAmount,
  },
  {
    key: 'balance',
    label: 'Solde',
    sortable: true,
    align: 'right',
    width: 14,
    render: formatAmount,
  },
  {
    key: 'is_active',
    label: 'Statut',
    sortable: true,
    width: 10,
    render: (isActive) => (isActive ? 'Actif' : 'Inactif'),
  },
]

export default function Accounts() {
  const navigate = useNavigate()

  const [appliedParams, setAppliedParams] = useState({})

  const [accounts, setAccounts] = useState([])
  const [balances, setBalances] = useState({}) // id -> { total_debit, total_credit, balance }
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setError(null)

    getAccounts(appliedParams)
      .then(async (data) => {
        if (cancelled) return
        setAccounts(data)

        const balanceEntries = await Promise.all(
          data.map((account) =>
            getAccountBalance(account.id)
              .then((b) => [account.id, b])
              .catch(() => [account.id, null]),
          ),
        )
        if (cancelled) return

        setBalances(Object.fromEntries(balanceEntries))
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
  }, [appliedParams, refreshKey])

  const rows = useMemo(
    () =>
      accounts.map((account) => {
        const balance = balances[account.id]
        return {
          ...account,
          total_debit: balance?.total_debit ?? null,
          total_credit: balance?.total_credit ?? null,
          balance: balance?.balance ?? null,
        }
      }),
    [accounts, balances],
  )

  function handleCreateAccount() {
    setIsCreateOpen(true)
  }

  function handleAccountCreated() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="accounts">
      <header className="page-header">
        <h1>Comptes</h1>
        <div className="accounts-header-actions">
          <button type="button" className="button" onClick={handleCreateAccount}>
            Créer un compte
          </button>
          <Link to="/" className="button">
            Journaux
          </Link>
        </div>
      </header>

      <FilterBar schema={FILTER_SCHEMA} onApply={setAppliedParams} />

      <div className="accounts-table-container">
        {status === 'loading' && <p className="muted">Chargement…</p>}
        {status === 'error' && <p className="error">Échec du chargement des comptes : {error}</p>}
        {status === 'ready' && (
          <Table
            columns={COLUMNS}
            data={rows}
            emptyMessage="Aucun compte."
            onRowClick={(account) => navigate(`/accounts/${account.id}`)}
          />
        )}
      </div>

      <Popup open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Créer un compte">
        <CreateAccountPopup onClose={() => setIsCreateOpen(false)} onCreated={handleAccountCreated} />
      </Popup>
    </div>
  )
}
