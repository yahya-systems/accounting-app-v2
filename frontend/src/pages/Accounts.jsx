import { Link } from 'react-router-dom'

export default function Accounts() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>Accounts</h1>
        <Link to="/" className="button">
          Journals
        </Link>
      </header>

      <p className="muted">Coming soon.</p>
    </div>
  )
}
