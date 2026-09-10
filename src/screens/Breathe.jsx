import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import FocusHeader from '../components/FocusHeader.jsx'
import { breathingSessions } from '../data/index.js'

const TOTAL_CYCLES = 4

/** Sizes the circle moves between, in pixels. */
const SMALL = 80
const LARGE = 160

const MODES = {
  box: {
    label: 'Box',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'hold', seconds: 4 },
      { kind: 'exhale', seconds: 4 },
      { kind: 'hold', seconds: 4 },
    ],
  },
  478: {
    label: '4-7-8',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'hold', seconds: 7 },
      { kind: 'exhale', seconds: 8 },
    ],
  },
}

const PHASE_LABEL = { inhale: 'Breathe in', hold: 'Hold', exhale: 'Breathe out' }

/**
 * Explicit order. "478" is an integer-like key, so Object.keys would hoist
 * it above "box" no matter how the object is written.
 */
const MODE_ORDER = ['box', '478']

export default function Breathe() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const checkInId = params.get('checkIn')

  const [mode, setMode] = useState('box')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [cycles, setCycles] = useState(0)
  const [remaining, setRemaining] = useState(MODES.box.phases[0].seconds)
  const [finished, setFinished] = useState(false)

  const phases = MODES[mode].phases
  const phase = phases[phaseIndex]

  const phaseStart = useRef(0)
  const savedRef = useRef(false)

  /** Record the session. Called once, on completion or on leaving early. */
  const save = useCallback(
    async (cyclesCompleted) => {
      if (savedRef.current) return
      savedRef.current = true
      try {
        await breathingSessions.create({ checkInId, mode, cyclesCompleted })
      } catch {
        // a lost session should never block someone leaving the screen
      }
    },
    [checkInId, mode],
  )

  // the clock. Remaining time is derived from a timestamp rather than
  // counted down, so it cannot drift over a long session.
  useEffect(() => {
    if (finished) return

    phaseStart.current = Date.now()

    const tick = setInterval(() => {
      const elapsed = (Date.now() - phaseStart.current) / 1000
      const left = phases[phaseIndex].seconds - elapsed

      if (left > 0) {
        setRemaining(Math.ceil(left))
        return
      }

      const nextPhase = phaseIndex + 1
      if (nextPhase < phases.length) {
        setPhaseIndex(nextPhase)
        setRemaining(phases[nextPhase].seconds)
        return
      }

      // a full cycle just closed
      const done = cycles + 1
      setCycles(done)
      if (done >= TOTAL_CYCLES) {
        setFinished(true)
      } else {
        setPhaseIndex(0)
        setRemaining(phases[0].seconds)
      }
    }, 100)

    return () => clearInterval(tick)
  }, [phaseIndex, cycles, phases, finished])

  useEffect(() => {
    if (finished) save(TOTAL_CYCLES)
  }, [finished, save])

  function chooseMode(next) {
    if (next === mode) return
    setMode(next)
    setPhaseIndex(0)
    setCycles(0)
    setFinished(false)
    setRemaining(MODES[next].phases[0].seconds)
  }

  async function endEarly() {
    await save(cycles)
    navigate('/', { replace: true, state: { toast: 'Session saved' } })
  }

  async function finish() {
    await save(TOTAL_CYCLES)
    navigate('/', { replace: true, state: { toast: 'Session saved' } })
  }

  // the circle is large through the inhale and the hold that follows it
  const grown = phase.kind === 'inhale' || (phase.kind === 'hold' && phaseIndex === 1)
  const size = finished ? SMALL : grown ? LARGE : SMALL

  return (
    <>
      <FocusHeader />

      <main className="pb-safe flex flex-1 flex-col px-5 pb-8">
        <p className="label">Breathing</p>

        <div className="segment mt-4" role="group" aria-label="Breathing pattern">
          {MODE_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => chooseMode(key)}
              aria-pressed={mode === key}
            >
              {MODES[key].label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10">
          {finished ? (
            <div className="text-center">
              <p className="text-[22px] font-medium tracking-tight">Well done.</p>
              <p className="text-ink-soft mt-1 text-[17px]">Take a moment.</p>
            </div>
          ) : (
            <>
              <div
                className="breath-orb"
                style={{
                  width: size,
                  height: size,
                  '--breath-duration': `${phase.kind === 'hold' ? 0 : phase.seconds}s`,
                }}
              >
                <span className="breath-count" aria-hidden="true">
                  {remaining}
                </span>
              </div>

              <div className="text-center" aria-live="polite">
                <p className="text-[19px] font-medium tracking-tight">
                  {PHASE_LABEL[phase.kind]}
                </p>
                <p className="text-ink-faint mt-1.5 text-[13px]">
                  Cycle {Math.min(cycles + 1, TOTAL_CYCLES)} of {TOTAL_CYCLES}
                </p>
              </div>
            </>
          )}
        </div>

        {finished ? (
          <button type="button" onClick={finish} className="btn btn-primary">
            Done
          </button>
        ) : (
          <button type="button" onClick={endEarly} className="btn btn-quiet">
            End early
          </button>
        )}
      </main>
    </>
  )
}
