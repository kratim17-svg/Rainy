import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ChevronRight, PenLine, Wind } from 'lucide-react'
import Screen from './Screen.jsx'
import Toast from '../components/Toast.jsx'
import TodayList from '../components/TodayList.jsx'
import {
  brainDumps,
  breathingSessions,
  checkIns,
  notificationSettings,
  timelineFor,
} from '../data/index.js'
import { greetingFor, formatLongDate, nextReminder, prettyTime } from '../lib/time.js'

/** The two things you can do without checking in first. */
const OPEN_DOORS = [
  { to: '/brain-dump', Icon: PenLine, label: 'Write it out' },
  { to: '/breathe', Icon: Wind, label: 'Breathe with me' },
]

export default function Home() {
  const now = new Date()
  const location = useLocation()
  const navigate = useNavigate()

  const [toast, setToast] = useState(location.state?.toast ?? null)
  const [entries, setEntries] = useState(null)
  const [reminder, setReminder] = useState(null)

  useEffect(() => {
    let live = true

    const refresh = async () => {
      const [today, settings] = await Promise.all([timelineFor(), notificationSettings.get()])
      // the screen may have been left while the read was in flight
      if (!live) return
      setEntries(today)
      setReminder(nextReminder(settings))
    }

    refresh()
    // keep the list honest when a flow saves something, or a second tab does
    const stop = [checkIns, brainDumps, breathingSessions].map((repo) => repo.subscribe(refresh))

    return () => {
      live = false
      stop.forEach((off) => off())
    }
  }, [])

  const dismiss = useCallback(() => {
    setToast(null)
    navigate('.', { replace: true, state: null })
  }, [navigate])

  return (
    <Screen label={formatLongDate(now)} title={greetingFor(now)}>
      <Link
        to="/check-in"
        className="sheet mt-8 flex items-center justify-between gap-4 p-6"
      >
        <span className="text-[17px] leading-snug font-medium tracking-tight">
          How are you feeling right now?
        </span>
        <ChevronRight size={20} className="text-ink-faint shrink-0" aria-hidden="true" />
      </Link>

      {/* Open on their own terms — no check-in required, and no suggestion
          that taking one of these is skipping a step. */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {OPEN_DOORS.map(({ to, Icon, label }) => (
          <Link key={to} to={to} className="sheet flex flex-col gap-3 p-5">
            <Icon size={20} strokeWidth={1.75} className="text-ink-soft" aria-hidden="true" />
            <span className="text-[15px] leading-snug font-medium tracking-tight">{label}</span>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="label">Today&rsquo;s check-ins</h2>

        {entries === null ? (
          <p className="text-ink-faint mt-3 text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-ink-soft mt-3 text-[15px] leading-relaxed">
            Nothing logged yet today.
            {reminder &&
              ` Your first reminder is at ${prettyTime(reminder.time)}${
                reminder.tomorrow ? ' tomorrow' : ''
              }.`}
          </p>
        ) : (
          <TodayList entries={entries} />
        )}
      </section>

      {toast && <Toast message={toast} onDone={dismiss} />}
    </Screen>
  )
}
