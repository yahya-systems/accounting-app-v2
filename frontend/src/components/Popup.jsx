import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Popup.css'

// Shared stack of currently-open popups' close handlers, most-recent last.
// Lets nested popups (e.g. a picker opened from within a form popup) ensure
// only the topmost one responds to Escape, instead of every open popup
// closing at once.
const openPopupStack = []

// Generic modal shell. Content is entirely up to the caller — this component
// only owns the overlay, positioning, dismissal (Esc / click-outside), and title bar.
export default function Popup({ open, onClose, title, children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return

    openPopupStack.push(onClose)

    function handleKeyDown(e) {
      if (e.key !== 'Escape') return
      const topmost = openPopupStack[openPopupStack.length - 1]
      if (topmost === onClose) onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const index = openPopupStack.lastIndexOf(onClose)
      if (index !== -1) openPopupStack.splice(index, 1)
    }
  }, [open, onClose])

  if (!open) return null

  function handleOverlayClick(e) {
    if (!panelRef.current || panelRef.current.contains(e.target)) return
    // Popups now portal to document.body, so nested popups are DOM siblings,
    // not descendants — an outside click on this overlay may actually be a
    // click meant for a popup stacked on top of this one (e.g. opening it).
    // Only the topmost popup in the stack should react to an outside click.
    const topmost = openPopupStack[openPopupStack.length - 1]
    if (topmost === onClose) onClose?.()
  }

  return createPortal(
    <div className="popup-overlay" onMouseDown={handleOverlayClick}>
      <div className="popup-panel" ref={panelRef} role="dialog" aria-modal="true">
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
