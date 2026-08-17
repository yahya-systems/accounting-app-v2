import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getAccount,
  getAccountBalance,
  getAccountJournalLines,
  getJournals,
  updateAccount,
} from '../../../api/client'
import { formatAmount } from '../../../utils/format'
import Table from '../../../components/Table'
import Popup from '../../../components/Popup'
import FilterBar from '../../../components/FilterBar'
import JournalLineDetailPopup from '../../../components/JournalLineDetailPopup'
import EditAccountPopup from './EditAccountPopup'
import PencilIcon from '../../../components/PencilIcon'
import './AccountDetail.css'

const COLUMNS = [
  { key: 'date', label: 'Date', sortable: true, width: 10, render: (v) => v?.slice(0, 10) },
  {
    key: 'journal_name',
    label: 'Journal',
    sortable: true,
    width: 24,
  },
  {
    key: 'description',
    label: 'Description',
    sortable: true,
  },
  {
    key: 'debit_amount',
    label: 'Débit',
    sortable: true,
    align: 'right',
    width: 18,
    render: formatAmount,
  },
  {
    key: 'credit_amount',
    label: 'Crédit',
    sortable: true,
    align: 'right',
    width: 18,
    render: formatAmount,
  },
]

const TYPE_OPTIONS = [
  { value: 'debit', label: 'Débit' },
  { value: 'credit', label: 'Crédit' },
]

export default function AccountDetail() {
  const { id } = useParams()

  const [account, setAccount] = useState(null)
  const [accountStatus, setAccountStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [accountError, setAccountError] = useState(null)
  const [accountRefreshKey, setAccountRefreshKey] = useState(0)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false)
  const [deactivateStatus, setDeactivateStatus] = useState('idle') // 'idle' | 'working' | 'error'
  const [deactivateError, setDeactivateError] = useState(null)

  const [journals, setJournals] = useState([])

  const [appliedParams, setAppliedParams] = useState({})

  const [lines, setLines] = useState([])
  const [linesStatus, setLinesStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [linesError, setLinesError] = useState(null)
  const [linesRefreshKey, setLinesRefreshKey] = useState(0)

  const [selectedLineId, setSelectedLineId] = useState(null)

  const [balance, setBalance] = useState(null)
  const [balanceStatus, setBalanceStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [balanceError, setBalanceError] = useState(null)

  useEffect(() => {
    let cancelled = false

    setAccountStatus('loading')
    setAccountError(null)

    getAccount(id)
      .then((data) => {
        if (cancelled) return
        setAccount(data)
        setAccountStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setAccountError(err.message)
        setAccountStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [id, accountRefreshKey])

  useEffect(() => {
    let cancelled = false

    getJournals()
      .then((data) => {
        if (cancelled) return
        setJournals(data)
      })
      .catch(() => {
        if (cancelled) return
        setJournals([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    setLinesStatus('loading')
    setLinesError(null)

    getAccountJournalLines(id, appliedParams)
      .then((data) => {
        if (cancelled) return
        setLines(data)
        setLinesStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLinesError(err.message)
        setLinesStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [id, appliedParams, linesRefreshKey])

  useEffect(() => {
    let cancelled = false

    setBalanceStatus('loading')
    setBalanceError(null)

    const balanceParams = {}
    if (appliedParams.from) balanceParams.from = appliedParams.from
    if (appliedParams.to) balanceParams.to = appliedParams.to

    getAccountBalance(id, balanceParams)
      .then((data) => {
        if (cancelled) return
        setBalance(data)
        setBalanceStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setBalanceError(err.message)
        setBalanceStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [id, appliedParams, linesRefreshKey])

  const rows = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        journal_name: line.journal?.name ?? null,
      })),
    [lines],
  )

  const filterSchema = useMemo(
    () => [
      { key: 'from', label: 'Du', type: 'date', param: 'from' },
      { key: 'to', label: 'Au', type: 'date', param: 'to' },
      {
        key: 'journalId',
        label: 'Journal',
        type: 'select',
        param: 'journal_id',
        options: journals.map((journal) => ({ value: journal.id, label: journal.name })),
      },
      { key: 'type', label: 'Type', type: 'select', param: 'type', options: TYPE_OPTIONS },
      { key: 'description', label: 'Description', type: 'text', param: 'description', placeholder: 'Recherche' },
    ],
    [journals],
  )

  function handleAccountUpdated() {
    setAccountRefreshKey((k) => k + 1)
  }

  function handleLineUpdated() {
    setLinesRefreshKey((k) => k + 1)
  }

  async function handleConfirmDeactivate() {
    setDeactivateStatus('working')
    setDeactivateError(null)

    try {
      await updateAccount(id, { is_active: false })
      setIsDeactivateConfirmOpen(false)
      setDeactivateStatus('idle')
      setAccountRefreshKey((k) => k + 1)
    } catch (err) {
      setDeactivateError(err.message)
      setDeactivateStatus('error')
    }
  }

  return (
    <div className="account-detail">
      <header className="page-header">
        <h1>Compte</h1>
        <Link to="/accounts" className="button">
          Comptes
        </Link>
      </header>

      {accountStatus === 'loading' && <p className="muted">Chargement…</p>}
      {accountStatus === 'error' && <p className="error">Échec du chargement du compte : {accountError}</p>}
      {accountStatus === 'ready' && account && (
        <div className="account-detail-info">
          <div className="account-detail-info-header">
            <div>
              <h2>{account.name}</h2>
              <p className="account-detail-id">{account.id}</p>
            </div>
            <div className="account-detail-info-actions">
              <button
                type="button"
                className="button icon-button"
                onClick={() => setIsEditOpen(true)}
                aria-label="Modifier le compte"
                title="Modifier le compte"
              >
                <PencilIcon />
              </button>
              {account.is_active && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setDeactivateError(null)
                    setIsDeactivateConfirmOpen(true)
                  }}
                >
                  Désactiver le compte
                </button>
              )}
            </div>
          </div>

          {account.description && <p className="account-detail-description">{account.description}</p>}

          {!account.is_active && <p className="badge">Inactif</p>}

          {account.metadata && Object.keys(account.metadata).length > 0 && (
            <dl className="account-detail-metadata">
              {Object.entries(account.metadata).map(([key, value]) => (
                <div className="account-detail-metadata-row" key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <FilterBar schema={filterSchema} onApply={setAppliedParams} />

      <div className="account-detail-table-container">
        {linesStatus === 'loading' && <p className="muted">Chargement…</p>}
        {linesStatus === 'error' && (
          <p className="error">Échec du chargement des écritures : {linesError}</p>
        )}
        {linesStatus === 'ready' && (
          <Table
            columns={COLUMNS}
            data={rows}
            emptyMessage="Aucune écriture."
            onRowClick={(line) => setSelectedLineId(line.id)}
          />
        )}
      </div>

      <div className="account-detail-balance">
        {balanceStatus === 'loading' && <p className="muted">Chargement du solde…</p>}
        {balanceStatus === 'error' && (
          <p className="error">Échec du chargement du solde : {balanceError}</p>
        )}
        {balanceStatus === 'ready' && balance && (
          <>
            <p className="account-detail-balance-label">
              {appliedParams.from || appliedParams.to
                ? `Total du ${appliedParams.from || '…'} au ${appliedParams.to || '…'} (aucun autre filtre n'est pris en compte)`
                : 'Total'}
            </p>
            <div className="account-detail-balance-values">
              <div className="account-detail-balance-item">
                <span className="account-detail-balance-item-label">Débit total</span>
                <span className="account-detail-balance-item-value">
                  {formatAmount(balance.total_debit)}
                </span>
              </div>
              <div className="account-detail-balance-item">
                <span className="account-detail-balance-item-label">Crédit total</span>
                <span className="account-detail-balance-item-value">
                  {formatAmount(balance.total_credit)}
                </span>
              </div>
              <div className="account-detail-balance-item">
                <span className="account-detail-balance-item-label">Solde</span>
                <span className="account-detail-balance-item-value">
                  {formatAmount(balance.balance)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {account && (
        <Popup open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Modifier le compte">
          <EditAccountPopup
            account={account}
            onClose={() => setIsEditOpen(false)}
            onUpdated={handleAccountUpdated}
          />
        </Popup>
      )}

      <Popup
        open={isDeactivateConfirmOpen}
        onClose={() => setIsDeactivateConfirmOpen(false)}
        title="Désactiver le compte"
      >
        <div className="deactivate-confirm">
          <p>Voulez-vous vraiment désactiver ce compte ?</p>
          {deactivateStatus === 'error' && <p className="error">{deactivateError}</p>}
          <div className="form-actions">
            <button
              type="button"
              className="button"
              onClick={() => setIsDeactivateConfirmOpen(false)}
              disabled={deactivateStatus === 'working'}
            >
              Annuler
            </button>
            <button
              type="button"
              className="button"
              onClick={handleConfirmDeactivate}
              disabled={deactivateStatus === 'working'}
            >
              {deactivateStatus === 'working' ? 'Désactivation…' : 'Désactiver'}
            </button>
          </div>
        </div>
      </Popup>

      <Popup
        open={selectedLineId !== null}
        onClose={() => setSelectedLineId(null)}
        title="Écriture"
      >
        {selectedLineId !== null && (
          <JournalLineDetailPopup
            lineId={selectedLineId}
            onClose={() => setSelectedLineId(null)}
            onUpdated={handleLineUpdated}
          />
        )}
      </Popup>
    </div>
  )
}
