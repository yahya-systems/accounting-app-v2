const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Formats a numeric-string amount (e.g. "63000.00") to French grouping, e.g. "63 000,00".
export function formatAmount(value) {
  if (value === null || value === undefined) return ''
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return currencyFormatter.format(num)
}

// Converts a "MM-DD" month-day string (year-less, as used by the journal-line
// API for POST/PATCH) to a "YYYY-MM-DD" string using the current year, for
// use as a native <input type="date"> value.
export function dayMonthToDateInputValue(monthDay) {
  const match = /^(\d{2})-(\d{2})$/.exec(monthDay ?? '')
  if (!match) return ''
  const [, mm, dd] = match
  const year = new Date().getFullYear()
  return `${year}-${mm}-${dd}`
}

// Converts a native <input type="date"> value ("YYYY-MM-DD") back to the
// "MM-DD" format the API expects (year is stripped, added server-side).
export function dateInputValueToDayMonth(dateValue) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateValue ?? '')
  if (!match) return ''
  const [, mm, dd] = match
  return `${mm}-${dd}`
}

// Converts a "YYYY-MM-DD" date string, as returned by GET journal-line
// endpoints (raw Postgres date, see backend's src/db/pool.ts), to "MM-DD"
// (year-less, as used for editing/PATCHing).
export function fullDateToDayMonth(fullDate) {
  const datePart = fullDate?.slice(0, 10)
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(datePart ?? '')
  if (!match) return ''
  const [, mm, dd] = match
  return `${mm}-${dd}`
}
