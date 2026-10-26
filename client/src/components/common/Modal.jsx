import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, title, onClose, children, footer }) {
  const tituloId = useId()
  const panel = useRef(null)
  const cierre = useRef(onClose)

  useEffect(() => {
    cierre.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined

    const previo = document.activeElement
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()

    const alTeclear = (e) => {
      if (e.key === 'Escape') {
        cierre.current?.()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll(FOCUSABLES)]
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const primero = items[0]
      const ultimo = items[items.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflowPrevio
      previo?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
      >
        <h2 id={tituloId} className="modal__title">
          {title}
        </h2>
        {children}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}