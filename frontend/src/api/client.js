const BASE_URL = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    let details = null
    try {
      const body = await res.json()
      if (body?.error) {
        details = body.error
        message = typeof body.error === 'string' ? body.error : 'Validation error'
      }
    } catch {
      // ignore non-JSON error bodies
    }
    const err = new Error(message)
    err.details = details // raw error payload from server (string or Zod issues array)
    throw err
  }

  if (res.status === 204) return null
  return res.json()
}

export function getJournals(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journals${query ? `?${query}` : ''}`)
}

export function getJournal(id) {
  return request(`/journals/${id}`)
}

export function createJournal(data) {
  return request('/journals', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateJournal(id, data) {
  return request(`/journals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getAccounts(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/accounts${query ? `?${query}` : ''}`)
}

export function getAccount(id) {
  return request(`/accounts/${id}`)
}

export function createAccount(data) {
  return request('/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAccount(id, data) {
  return request(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function getPcgReference(code) {
  return request(`/pcg-reference/${code}`)
}

export function getAccountBalance(id, params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/accounts/${id}/balance${query ? `?${query}` : ''}`)
}


export function getJournalBalance(id, params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journals/${id}/balance${query ? `?${query}` : ''}`)
}

export function getAccountJournalLines(id, params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/accounts/${id}/journal-lines${query ? `?${query}` : ''}`)
}

// Kept because /transactions?journal_id=X can't filter by account_id or
// line-level description — only /journals/:id/journal-lines can, per
// backend mem:api_endpoints. Reads join through transactions now.
export function getJournalLines(journalId, params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journals/${journalId}/journal-lines${query ? `?${query}` : ''}`)
}

// Flat cross-journal read view — kept, GET-only now (write endpoints on this
// route were deleted in the transactions refactor).
export function getAllJournalLines(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journal-lines${query ? `?${query}` : ''}`)
}

export function getJournalLine(id) {
  return request(`/journal-lines/${id}`)
}

// ---- Transactions (new module — see mem:api_endpoints) ----
// A transaction groups journal-line drafts and enforces debit=credit before
// anything reaches the real ledger. Lines only exist as drafts
// (journal_line_drafts) until POST /transactions/:id/post commits them.

export function getTransactions(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/transactions${query ? `?${query}` : ''}`)
}

export function getTransaction(id) {
  return request(`/transactions/${id}`)
}

// All fields optional — a transaction can be created fully bare and filled
// in later via PATCH. journal_id/date/name are only required by the time
// it's posted (enforced by a DB CHECK, not this call).
export function createTransaction(data = {}) {
  return request('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTransaction(id, data) {
  return request(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

// 409 if status is already 'posted'. Cascades to line drafts automatically.
export function deleteTransaction(id) {
  return request(`/transactions/${id}`, { method: 'DELETE' })
}

export function createLineDraft(transactionId, data) {
  return request(`/transactions/${transactionId}/lines`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateLineDraft(transactionId, lineId, data) {
  return request(`/transactions/${transactionId}/lines/${lineId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteLineDraft(transactionId, lineId) {
  return request(`/transactions/${transactionId}/lines/${lineId}`, { method: 'DELETE' })
}

// {total_debit, total_credit, sold} — note: "sold", not "solde" (that's the
// journal-balance endpoint's field name, which is a different word).
export function getTransactionBalance(id) {
  return request(`/transactions/${id}/balance`)
}

// The atomic flush: re-verifies balance server-side (409 if unbalanced or
// zero lines), moves draft lines into journal_lines, sets status='posted'.
export function postTransaction(id) {
  return request(`/transactions/${id}/post`, { method: 'POST' })
}
