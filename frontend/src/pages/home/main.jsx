import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getJournals, getJournalLines } from '../../api/client'
import { formatAmount } from '../../utils/format'
import Table from '../../components/Table'
import Popup from '../../components/Popup'
import JournalLineDetailPopup from '../../components/JournalLineDetailPopup'
import JournalHeader from '../../components/JournalHeader'
import CreateJournalPopup from './CreateJournalPopup'
import './Home.css'

const LINE_COLUMNS = [
  { key: 'date', label: 'Date', sortable: true, width: 12 },
  {
    key: 'account',
    label: 'Compte',
    sortable: true,
    render: (account) => `${account.id} — ${account.name}`,
  },
  { key: 'description', label: 'Description', sortable: true },
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
  const navigate = useNavigate()
  const [journals, setJournals] = useState([])
  const [journalsStatus, setJournalsStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [journalsError, setJournalsError] = useState(null)

  const [journalsRefreshKey, setJournalsRefreshKey] = useState(0)
  const [isCreateJournalOpen, setIsCreateJournalOpen] = useState(false)

  const [selectedJournal, setSelectedJournal] = useState(null)
  const [lines, setLines] = useState([])
  const [linesStatus, setLinesStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [linesError, setLinesError] = useState(null)
  const [linesRefreshKey, setLinesRefreshKey] = useState(0)

  const [selectedLineId, setSelectedLineId] = useState(null)

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
  }, [journalsRefreshKey])

  useEffect(() => {
    if (!selectedJournal) return
    let cancelled = false

    setLinesStatus('loading')
    setLinesError(null)

    getJournalLines(selectedJournal.id)
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
  }, [selectedJournal, linesRefreshKey])

  function handleSelectJournal(journal) {
    setSelectedJournal(journal)
  }

  function handleLearnMore() {
    if (selectedJournal) navigate(`/journals/${selectedJournal.id}`)
  }

  function handleJournalCreated() {
    setJournalsRefreshKey((k) => k + 1)
  }

  function handleLineUpdated() {
    setLinesRefreshKey((k) => k + 1)
  }

  return (
    <div className="home">
      <aside className="home-sidebar">
        <div className="home-sidebar-scroll">
          <header className="page-header">
            <h1>Journaux</h1>
            <button
              type="button"
              className="button home-create-journal"
              onClick={() => setIsCreateJournalOpen(true)}
              aria-label="Créer un journal"
              title="Créer un journal"
            >
              +
            </button>
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
        </div>

        <div className="home-nav-links">
          <Link to="/accounts" className="button home-nav-link">
            Comptes
          </Link>
          <Link to="/journal-lines" className="button home-nav-link">
            Écritures
          </Link>
        </div>
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
            <Table
              columns={LINE_COLUMNS}
              data={lines}
              emptyMessage="Aucune écriture."
              onRowClick={(line) => setSelectedLineId(line.id)}
            />
          </div>
        )}
      </main>

      <Popup
        open={isCreateJournalOpen}
        onClose={() => setIsCreateJournalOpen(false)}
        title="Créer un journal"
      >
        <CreateJournalPopup
          onClose={() => setIsCreateJournalOpen(false)}
          onCreated={handleJournalCreated}
        />
      </Popup>

      <Popup open={selectedLineId !== null} onClose={() => setSelectedLineId(null)} title="Écriture">
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
