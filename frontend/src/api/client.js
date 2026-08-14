const BASE_URL = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message)
  }

  if (res.status === 204) return null
  return res.json()
}

export function getJournals(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journals${query ? `?${query}` : ''}`)
}

export function getAccounts(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/accounts${query ? `?${query}` : ''}`)
}

export function getJournalLines(journalId, params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/journals/${journalId}/journal-lines${query ? `?${query}` : ''}`)
}
