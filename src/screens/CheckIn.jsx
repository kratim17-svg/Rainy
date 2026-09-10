import { useState } from 'react'
import { useNavigate } from 'react-router'
import FocusHeader from '../components/FocusHeader.jsx'
import ScoreScale from '../components/ScoreScale.jsx'
import { checkIns } from '../data/index.js'
import { bandForScore, needsSupport, textClassFor } from '../lib/scoring.js'
import { slotForDate } from '../lib/time.js'

export default function CheckIn() {
  const navigate = useNavigate()
  const [score, setScore] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const chosen = score !== null
  const band = chosen ? bandForScore(score) : null

  async function save() {
    if (!chosen || saving) return
    setSaving(true)
    setError(null)

    try {
      const checkIn = await checkIns.create({ timeSlot: slotForDate(), score })

      // The check-in is saved either way. What follows is only an offer, so
      // leaving now still keeps the record.
      if (needsSupport(score)) {
        navigate(`/check-in/support?checkIn=${checkIn.id}`, { replace: true })
      } else {
        navigate('/', { replace: true, state: { toast: 'Logged' } })
      }
    } catch (cause) {
      setError(cause.message)
      setSaving(false)
    }
  }

  return (
    <>
      <FocusHeader />

      <main className="pb-safe flex flex-1 flex-col px-5 pb-8">
      <p className="label">Check in</p>
      <h1 className="mt-2 text-[26px] leading-tight font-medium tracking-tight">
        How are you feeling right now?
      </h1>

      <div className="flex flex-1 flex-col justify-center py-10">
        {/* an invisible 0 holds the height, so picking a score shifts nothing */}
        <p
          className={`text-center text-[88px] leading-none font-light tracking-tight tabular-nums ${
            chosen ? textClassFor(band) : 'invisible'
          }`}
          aria-hidden="true"
        >
          {chosen ? score : 0}
        </p>
        <p className="text-ink-soft mt-4 text-center text-sm">
          {chosen ? `${score} out of 10` : 'Tap a circle below'}
        </p>

        <div className="mt-12">
          <ScoreScale value={score} onChange={setScore} />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-high mb-4 text-center text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!chosen || saving}
        className="btn btn-primary"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      </main>
    </>
  )
}
