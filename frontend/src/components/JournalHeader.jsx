import './JournalHeader.css'

export default function JournalHeader({ journal, onLearnMore }) {
  return (
    <div className="journal-header">
      <div className="journal-header-text">
        <h2 className="journal-header-title">{journal.name}</h2>
        {journal.description && (
          <p className="journal-header-description">{journal.description}</p>
        )}
      </div>
      <button type="button" className="button" onClick={onLearnMore}>
        En savoir plus
      </button>
    </div>
  )
}
