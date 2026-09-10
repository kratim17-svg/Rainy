import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import FocusHeader from '../components/FocusHeader.jsx'
import { brainDumps } from '../data/index.js'
import { wordFrequencies } from '../lib/words.js'

const AUTOSAVE_MS = 2000

export default function BrainDump() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const checkInId = params.get('checkIn')

  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)
  const [finishing, setFinishing] = useState(false)

  // The id of the record once it exists, and a promise chain so overlapping
  // saves cannot create two records for one sitting.
  const idRef = useRef(null)
  const chainRef = useRef(Promise.resolve())
  const textRef = useRef('')
  useEffect(() => {
    textRef.current = text
  }, [text])

  const persist = useCallback(
    (value, extra) => {
      chainRef.current = chainRef.current
        .then(async () => {
          const body = value.trim()
          if (!body) return

          if (idRef.current) {
            await brainDumps.update(idRef.current, { text: body, ...extra })
          } else {
            const saved = await brainDumps.create({ checkInId, text: body, ...extra })
            idRef.current = saved.id
          }
          setStatus('Saved')
          setError(null)
        })
        .catch((cause) => setError(cause.message))
      return chainRef.current
    },
    [checkInId],
  )

  // autosave, two seconds after typing stops
  useEffect(() => {
    if (!text.trim()) return
    const timer = setTimeout(() => persist(text), AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [text, persist])

  // a save in flight when the screen closes still completes
  useEffect(() => () => persist(textRef.current), [persist])

  async function done() {
    if (finishing) return
    setFinishing(true)

    const body = text.trim()

    // nothing written — do not leave an empty record behind
    if (!body) {
      if (idRef.current) await brainDumps.remove(idRef.current)
      navigate('/', { replace: true })
      return
    }

    await persist(body, { wordFrequencies: wordFrequencies(body) })
    navigate('/', { replace: true, state: { toast: 'Saved' } })
  }

  return (
    <>
      <FocusHeader
        action={
          <div className="flex items-center gap-3">
            <span className="label" aria-live="polite">
              {status}
            </span>
            <button
              type="button"
              onClick={done}
              disabled={finishing}
              className="btn btn-primary w-auto min-h-10 px-5 text-sm"
            >
              Done
            </button>
          </div>
        }
      />

      <main className="pb-safe flex flex-1 flex-col px-5 pb-6">
        <label htmlFor="dump" className="sr-only">
          Brain dump
        </label>
        <textarea
          id="dump"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setStatus('')
          }}
          placeholder="What's on your mind right now? No filter needed."
          autoFocus
          spellCheck="false"
          className="placeholder:text-ink-faint flex-1 resize-none bg-transparent text-[17px] leading-relaxed outline-none"
        />

        {error && (
          <p role="alert" className="text-high pt-3 text-sm">
            {error}
          </p>
        )}
      </main>
    </>
  )
}
