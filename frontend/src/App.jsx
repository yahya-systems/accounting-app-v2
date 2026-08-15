import { Routes, Route } from 'react-router-dom'
import Home from './pages/home/main'
import Accounts from './pages/accounts/main'
import AccountDetail from './pages/accounts/detail/main'
import JournalDetail from './pages/journals/detail/main'
import JournalLines from './pages/journal-lines/main'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/accounts/:id" element={<AccountDetail />} />
      <Route path="/journals/:id" element={<JournalDetail />} />
      <Route path="/journal-lines" element={<JournalLines />} />
    </Routes>
  )
}
