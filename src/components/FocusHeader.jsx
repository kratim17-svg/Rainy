/**
 * The bar at the top of a focused screen: a way back, and optionally one
 * action on the right.
 */

import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'

export default function FocusHeader({ action, onBack }) {
  const navigate = useNavigate()

  return (
    <header className="app-bar pt-safe sticky top-0 z-10">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-6">
        <button
          type="button"
          onClick={onBack ?? (() => navigate(-1))}
          className="control control-sm"
          aria-label="Go back"
        >
          <ChevronLeft size={19} />
        </button>
        {action}
      </div>
    </header>
  )
}
