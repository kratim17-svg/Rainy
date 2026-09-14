/**
 * A panel that rises from the bottom of the screen.
 *
 * Closes on the backdrop, the button, or Escape, and holds the page still
 * underneath while it is open.
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function BottomSheet({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // stop the page behind from scrolling with the sheet
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet sheet-opaque pb-safe relative mx-auto flex max-h-[78dvh] w-full max-w-md flex-col rounded-b-none"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="min-w-0">
            <h2 className="text-[19px] font-medium tracking-tight">{title}</h2>
            {subtitle && <p className="text-ink-faint mt-1 text-[13px]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="control control-sm shrink-0" aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}
