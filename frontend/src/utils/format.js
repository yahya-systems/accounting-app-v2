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
