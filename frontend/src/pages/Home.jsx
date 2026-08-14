import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJournals, getJournalLines } from '../api/client'
import { formatAmount } from '../utils/format'
import Table from '../components/Table'
import JournalHeader from '../components/JournalHeader'
import './Home.css'

const LINE_COLUMNS = [
  { key: 'date', label: 'Date', sortable: true, width: 12 },
  {
    key: 'account',
    label: 'Compte',
    sortable: true,
    render: (account) => `${account.id} — ${account.name}`,
  },
  {
    key: 'debit_amount',
    label: 'Débit',
    sortable: true,
    align: 'right',
    width: 14,
    render: formatAmount,
  },
  {
    key: 'credit_amount',
    label: 'Crédit',
    sortable: true,
    align: 'right',
    width: 14,
    render: formatAmount,
  },
]

export default function Home() {
  const [journals, setJournals] = useState([])
  const [journalsStatus, setJournalsStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [journalsError, setJournalsError] = useState(null)

  const [selectedJournal, setSelectedJournal] = useState(null)
  const [lines, setLines] = useState([])
  const [linesStatus, setLinesStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [linesError, setLinesError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getJournals()
      .then((data) => {
        if (cancelled) return
        setJournals(data)
        setJournalsStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setJournalsError(err.message)
        setJournalsStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleSelectJournal(journal) {
    setSelectedJournal(journal)
    setLinesStatus('loading')
    setLinesError(null)

    getJournalLines(journal.id)
      .then((data) => {
        setLines(data)
        setLinesStatus('ready')
      })
      .catch((err) => {
        setLinesError(err.message)
        setLinesStatus('error')
      })
  }

  function handleLearnMore() {
    // Dummy for now.
  }

  return (
    <div className="home">
      <aside className="home-sidebar">
        <header className="page-header">
          <h1>Journaux</h1>
          <Link to="/accounts" className="button">
            Comptes
          </Link>
        </header>

        {journalsStatus === 'loading' && <p className="muted">Chargement…</p>}
        {journalsStatus === 'error' && (
          <p className="error">Échec du chargement des journaux : {journalsError}</p>
        )}

        {journalsStatus === 'ready' && journals.length === 0 && (
          <p className="muted">Aucun journal.</p>
        )}

        {journalsStatus === 'ready' && journals.length > 0 && (
          <ul className="list">
            {journals.map((journal) => (
              <li key={journal.id} className="list-item">
                <button
                  type="button"
                  className={
                    selectedJournal?.id === journal.id
                      ? 'list-item-button selected'
                      : 'list-item-button'
                  }
                  onClick={() => handleSelectJournal(journal)}
                >
                  <span className="list-item-title">{journal.name}</span>
                  {journal.description && (
                    <span className="list-item-subtitle">{journal.description}</span>
                  )}
                  {!journal.is_active && <span className="badge">inactif</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="home-main">
        {!selectedJournal && <p className="muted">Sélectionnez un journal.</p>}

        {selectedJournal && linesStatus === 'loading' && <p className="muted">Chargement…</p>}

        {selectedJournal && linesStatus === 'error' && (
          <p className="error">Échec du chargement des écritures : {linesError}</p>
        )}

        {selectedJournal && linesStatus === 'ready' && (
          <div className="home-table-container">
            <JournalHeader journal={selectedJournal} onLearnMore={handleLearnMore} />
            <Table columns={LINE_COLUMNS} data={lines} emptyMessage="Aucune écriture." />
          </div>
        )}
      </main>
    </div>
  )
}
