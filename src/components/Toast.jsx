/**
 * A brief confirmation that takes itself away again.
 */

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

export default function Toast({ message, duration = 1500, onDone }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), duration - 200)
    const done = setTimeout(() => onDone?.(), duration)
    return () => {
      clearTimeout(fade)
      clearTimeout(done)
    }
  }, [duration, onDone])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-28 z-30 flex justify-center transition-opacity duration-200 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <span className="chip sheet sheet-solid text-low px-4 py-2.5">
        <Check size={15} />
        {message}
      </span>
    </div>
  )
}
