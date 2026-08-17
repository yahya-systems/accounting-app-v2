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

export function getJournalLines(journalId, params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journals/${journalId}/journal-lines${query ? `?${query}` : ''}`)
}

export function getAllJournalLines(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journal-lines${query ? `?${query}` : ''}`)
}

export function createJournalLine(lines) {
  return request('/journal-lines', {
    method: 'POST',
    body: JSON.stringify(Array.isArray(lines) ? lines : [lines]),
  })
}

export function getJournalLine(id) {
  return request(`/journal-lines/${id}`)
}

export function updateJournalLine(id, data) {
  return request(`/journal-lines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
