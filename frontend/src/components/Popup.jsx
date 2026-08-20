import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Popup.css'

// Shared stack of currently-open popups, most-recent (topmost) last. Each
// entry is a small mutable object so a popup's onClose can be kept current
// across re-renders without re-pushing. Lets nested popups (e.g. a picker
// opened from within a form popup) ensure only the topmost one responds to
// Escape/outside-click/focus, instead of every open popup reacting at once.
const openPopupStack = []

// Freezes (or unfreezes) the rest of the app — everything outside the popup
// portals — whenever any popup is open. Uses the native `inert` attribute so
// background content can't be clicked, focused/tabbed into, or reached by
// screen readers while a popup is up, and pairs it with a constant blur via
// CSS so the frozen state is visually obvious. Runs on every push/pop of
// openPopupStack rather than being tied to a single popup's lifecycle,
// since "is anything open" is a property of the whole stack.
function syncAppInert() {
  const root = document.getElementById('root')
  if (!root) return
  const shouldFreeze = openPopupStack.length > 0
  root.classList.toggle('app-blurred', shouldFreeze)
  if (shouldFreeze) {
    root.setAttribute('inert', '')
  } else {
    root.removeAttribute('inert')
  }
}

// Generic modal shell. Content is entirely up to the caller — this component
// only owns the overlay, positioning, dismissal (Esc / click-outside), and title bar.
export default function Popup({ open, onClose, title, children, panelClassName }) {
  const panelRef = useRef(null)
  const entryRef = useRef({ onClose })
  entryRef.current.onClose = onClose

  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!open) return

    const entry = entryRef.current
    openPopupStack.push(entry)
    syncAppInert()
    forceRender((n) => n + 1)

    function handleKeyDown(e) {
      if (e.key !== 'Escape') return
      if (openPopupStack[openPopupStack.length - 1] !== entry) return
      entry.onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const index = openPopupStack.indexOf(entry)
      if (index !== -1) openPopupStack.splice(index, 1)
      syncAppInert()
    }
  }, [open])

  if (!open) return null

  const isTopmost = openPopupStack[openPopupStack.length - 1] === entryRef.current

  function handleOverlayClick(e) {
    if (!panelRef.current || panelRef.current.contains(e.target)) return
    if (!isTopmost) return
    entryRef.current.onClose?.()
  }

  return createPortal(
    <div
      className={`popup-overlay${isTopmost ? ' popup-overlay-active' : ''}`}
      onMouseDown={handleOverlayClick}
      // Stacked-under popups are visually present but must not be reachable —
      // only the topmost popup in openPopupStack should accept focus/clicks.
      inert={!isTopmost ? '' : undefined}
    >
      <div
        className={panelClassName ? `popup-panel ${panelClassName}` : 'popup-panel'}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
      >
        {(title || onClose) && (
          <div className="popup-header">
            {title && <h2 className="popup-title">{title}</h2>}
            {onClose && (
              <button type="button" className="popup-close" onClick={onClose} aria-label="Fermer">
                ×
              </button>
            )}
          </div>
        )}
        <div className="popup-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
