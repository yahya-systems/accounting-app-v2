import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { themeBalham } from 'ag-grid-community'
import { getAccounts, getAccountBalance } from '@api/client'
import { formatAmount } from '@utils/format'
import Popup from '@components/Popup'
import FilterBar from '@components/FilterBar'
import CreateAccountPopup from './CreateAccountPopup'
import '../journals/detail/JournalDetail.css'
import './Accounts.css'

const FILTER_SCHEMA = [
  { key: 'id', label: 'Identifiant', type: 'text', param: 'id', placeholder: '4481', maxLength: 10 },
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

const SORTING_ORDER = ['asc', 'desc', null]

const COLUMN_DEFS = [
  { field: 'id', headerName: 'Identifiant', sortable: true, sortingOrder: SORTING_ORDER, flex: 1 },
  { field: 'name', headerName: 'Nom', sortable: true, sortingOrder: SORTING_ORDER, flex: 2 },
  {
    field: 'total_debit',
    headerName: 'Débit',
    sortable: true,
    sortingOrder: SORTING_ORDER,
    type: 'rightAligned',
    valueFormatter: (params) => formatAmount(params.value),
    flex: 1,
  },
  {
    field: 'total_credit',
    headerName: 'Crédit',
    sortable: true,
    sortingOrder: SORTING_ORDER,
    type: 'rightAligned',
    valueFormatter: (params) => formatAmount(params.value),
    flex: 1,
  },
  {
    field: 'balance',
    headerName: 'Solde',
    sortable: true,
    sortingOrder: SORTING_ORDER,
    type: 'rightAligned',
    valueFormatter: (params) => formatAmount(params.value),
    flex: 1,
  },
  {
    field: 'is_active',
    headerName: 'Statut',
    sortable: true,
    sortingOrder: SORTING_ORDER,
    valueFormatter: (params) => (params.value ? 'Actif' : 'Inactif'),
    flex: 0.7,
  },
]

const DEFAULT_COL_DEF = {
  editable: false,
  resizable: true,
}

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
          <button
            type="button"
            className="button icon-button"
            onClick={handleCreateAccount}
            aria-label="Créer un compte"
            title="Créer un compte"
          >
            +
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
          <div className="journal-detail-grid">
            <AgGridReact
              theme={themeBalham}
              columnDefs={COLUMN_DEFS}
              defaultColDef={DEFAULT_COL_DEF}
              rowData={rows}
              getRowId={(params) => String(params.data.id)}
              onRowClicked={(event) => navigate(`/accounts/${event.data.id}`)}
              overlayNoRowsTemplate="Aucun compte."
            />
          </div>
        )}
      </div>

      <Popup open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Créer un compte">
        <CreateAccountPopup onClose={() => setIsCreateOpen(false)} onCreated={handleAccountCreated} />
      </Popup>
    </div>
  )
}
