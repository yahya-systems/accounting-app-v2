import { useEffect, useMemo, useRef, useState } from 'react'
import './Table.css'

const SORT_NONE = null
const SORT_ASC = 'asc'
const SORT_DESC = 'desc'

function nextSortDirection(current) {
  if (current === SORT_NONE) return SORT_ASC
  if (current === SORT_ASC) return SORT_DESC
  return SORT_NONE
}

// Compares raw values with light type-sniffing: numeric-looking strings sort
// numerically, ISO-date-looking strings sort chronologically, everything
// else falls back to locale string comparison. Nulls always sort last.
function compareValues(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1

  const aNum = typeof a === 'number' ? a : Number(a)
  const bNum = typeof b === 'number' ? b : Number(b)
  const bothNumeric = a !== '' && b !== '' && !Number.isNaN(aNum) && !Number.isNaN(bNum)
  if (bothNumeric) return aNum - bNum

  const aDate = typeof a === 'string' ? Date.parse(a) : NaN
  const bDate = typeof b === 'string' ? Date.parse(b) : NaN
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) return aDate - bDate

  return String(a).localeCompare(String(b))
}

function defaultRowKey(row) {
  const firstKey = Object.keys(row)[0]
  return row[firstKey]
}

export default function Table({
  columns,
  data,
  onRowClick,
  rowKey = defaultRowKey,
  emptyMessage = 'No data',
}) {
  const [sortState, setSortState] = useState({ key: null, direction: SORT_NONE })
  const [fillerCount, setFillerCount] = useState(0)
  const containerRef = useRef(null)
  const headerRef = useRef(null)
  const bodyRowRef = useRef(null)

  const specifiedWidth = columns.reduce((sum, col) => sum + (col.width ?? 0), 0)
  const unspecifiedCount = columns.filter((col) => col.width === undefined).length
  const remaining = Math.max(0, 100 - specifiedWidth)
  const fallbackWidth = unspecifiedCount > 0 ? remaining / unspecifiedCount : 0

  const sortedData = useMemo(() => {
    if (sortState.direction === SORT_NONE || !sortState.key) return data

    const sorted = [...data].sort((rowA, rowB) => {
      const result = compareValues(rowA[sortState.key], rowB[sortState.key])
      return sortState.direction === SORT_ASC ? result : -result
    })
    return sorted
  }, [data, sortState])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    function recomputeFillerRows() {
      const headerHeight = headerRef.current?.offsetHeight ?? 0
      const rowHeight = bodyRowRef.current?.offsetHeight ?? 0
      if (rowHeight === 0) {
        setFillerCount(0)
        return
      }
      const dataHeight = sortedData.length * rowHeight
      const availableHeight = container.clientHeight - headerHeight - dataHeight
      const count = Math.max(0, Math.floor(availableHeight / rowHeight))
      setFillerCount(count)
    }

    recomputeFillerRows()

    const observer = new ResizeObserver(recomputeFillerRows)
    observer.observe(container)
    return () => observer.disconnect()
  }, [sortedData, columns])

  function handleHeaderClick(column) {
    if (!column.sortable) return
    setSortState((prev) => {
      const isSameColumn = prev.key === column.key
      const direction = nextSortDirection(isSameColumn ? prev.direction : SORT_NONE)
      return { key: direction === SORT_NONE ? null : column.key, direction }
    })
  }

  return (
    <div className="table-container" ref={containerRef}>
      <table className="table">
        <thead ref={headerRef}>
          <tr>
            {columns.map((column) => {
              const width = column.width ?? fallbackWidth
              const isSorted = sortState.key === column.key && sortState.direction !== SORT_NONE
              return (
                <th
                  key={column.key}
                  style={{ width: `${width}%`, textAlign: column.align ?? 'left' }}
                  className={column.sortable ? 'table-th sortable' : 'table-th'}
                  onClick={() => handleHeaderClick(column)}
                  aria-sort={
                    isSorted ? (sortState.direction === SORT_ASC ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <span className="table-th-content">
                    {column.label}
                    {column.sortable && (
                      <span className="table-sort-indicator">
                        {isSorted ? (sortState.direction === SORT_ASC ? '▲' : '▼') : ''}
                      </span>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 && (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          )}
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowKey(row)}
              ref={rowIndex === 0 ? bodyRowRef : undefined}
              className={onRowClick ? 'table-row clickable' : 'table-row'}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => {
                const value = row[column.key]
                return (
                  <td
                    key={column.key}
                    style={{ textAlign: column.align ?? 'left' }}
                    className="table-td"
                  >
                    {value === null || value === undefined
                      ? ''
                      : column.render
                        ? column.render(value, row)
                        : String(value)}
                  </td>
                )
              })}
            </tr>
          ))}
          {Array.from({ length: fillerCount }, (_, i) => (
            <tr key={`filler-${i}`} className="table-row-filler" aria-hidden="true">
              {columns.map((column) => (
                <td key={column.key} className="table-td">
                  &nbsp;
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
