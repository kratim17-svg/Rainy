import { useEffect, useMemo, useState } from 'react'
import Screen from './Screen.jsx'
import SlotChart from '../components/SlotChart.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import {
  allActivity,
  brainDumps,
  breathingSessions,
  checkIns,
  journalEntries,
} from '../data/index.js'
import {
  activeDayKeys,
  aggregateWords,
  averageByTimeSlot,
  excerptsFor,
  journalDayCount,
  mostAnxiousSlot,
  remindersResponded,
  streakFrom,
  withinDays,
} from '../lib/insights.js'
import { formatDayKey } from '../lib/time.js'
import { textClassFor } from '../lib/scoring.js'

/** Patterns need something to be a pattern across. */
const DAYS_NEEDED = 7
const RANGES = [7, 30]
const TOP_WORDS = 10

const WASH = { low: 'bg-low-wash', medium: 'bg-med-wash', high: 'bg-high-wash' }

/** 13px for the rarest word up to 22px for the most common. */
function wordSize(count, min, max) {
  if (max === min) return 17
  return 13 + ((count - min) / (max - min)) * 9
}

function Metric({ label, value, hint }) {
  return (
    <div className="sheet flex flex-col gap-1 p-4">
      <span className="label">{label}</span>
      <span className="text-[19px] leading-tight font-medium tracking-tight">{value}</span>
      {hint && <span className="text-ink-faint text-[12px]">{hint}</span>}
    </div>
  )
}

export default function Insights() {
  const [range, setRange] = useState(7)
  const [all, setAll] = useState(null)
  const [word, setWord] = useState(null)

  useEffect(() => {
    let live = true

    const refresh = async () => {
      const activity = await allActivity()
      if (live) setAll(activity)
    }

    refresh()
    const stop = [checkIns, brainDumps, breathingSessions, journalEntries].map((repo) =>
      repo.subscribe(refresh),
    )

    return () => {
      live = false
      stop.forEach((off) => off())
    }
  }, [])

  const view = useMemo(() => {
    if (!all) return null

    const days = activeDayKeys(all)
    const ranged = {
      checkIns: withinDays(all.checkIns, range),
      brainDumps: withinDays(all.brainDumps, range),
    }

    const averages = averageByTimeSlot(ranged.checkIns)
    const words = aggregateWords(ranged.brainDumps).slice(0, TOP_WORDS)
    const scoreByCheckIn = new Map(all.checkIns.map((row) => [row.id, row.score]))

    return {
      dayCount: days.size,
      enough: days.size >= DAYS_NEEDED,
      averages,
      worst: mostAnxiousSlot(averages),
      words,
      scoreByCheckIn,
      rangedDumps: ranged.brainDumps,
      anyDumps: all.brainDumps.length > 0,
      streak: streakFrom(days),
      reminders: remindersResponded(withinDays(all.checkIns, 7), 7),
      journalDays: journalDayCount(all.journalEntries),
    }
  }, [all, range])

  if (!view) return <Screen label="Patterns" title="Insights" />

  if (!view.enough) {
    return (
      <Screen label="Patterns" title="Insights">
        <p className="text-ink-soft mt-6 text-[15px] leading-relaxed">
          Keep checking in — your patterns will show up here after a week. You&rsquo;ve logged{' '}
          {view.dayCount} day{view.dayCount === 1 ? '' : 's'} so far.
        </p>
      </Screen>
    )
  }

  const counts = view.words.map((entry) => entry.count)
  const min = Math.min(...counts)
  const max = Math.max(...counts)

  const excerpts = word ? excerptsFor(word, view.rangedDumps, view.scoreByCheckIn) : []

  return (
    <Screen label="Patterns" title="Insights">
      {/* one row of filters, above everything they change */}
      <div className="segment mt-6" role="group" aria-label="Time range">
        {RANGES.map((days) => (
          <button key={days} type="button" onClick={() => setRange(days)} aria-pressed={range === days}>
            {days} days
          </button>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="label">Average score by time of day · 0&ndash;10</h2>
        <SlotChart rows={view.averages} />
        {view.worst && (
          <p className="text-ink-soft mt-2 text-[15px] leading-relaxed">
            You tend to feel most anxious in the{' '}
            <span className={textClassFor(view.worst.band)}>{view.worst.label.toLowerCase()}</span>.
          </p>
        )}
      </section>

      {view.anyDumps && (
        <section className="mt-10">
          <h2 className="label">What keeps coming up</h2>

          {view.words.length === 0 ? (
            <p className="text-ink-faint mt-3 text-[15px]">Nothing written in this range.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {view.words.map((entry) => (
                <li key={entry.word}>
                  <button
                    type="button"
                    onClick={() => setWord(entry.word)}
                    style={{ fontSize: `${wordSize(entry.count, min, max)}px` }}
                    className="chip bg-veil border-line hover:border-ink-faint border leading-none transition-colors"
                  >
                    {entry.word}
                    <span className="text-ink-faint text-[11px] tabular-nums">{entry.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="label">Where you are</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric
            label="Streak"
            value={view.streak === 0 ? 'Start today' : view.streak}
            hint={view.streak === 0 ? null : `day${view.streak === 1 ? '' : 's'} running`}
          />
          <Metric
            label="This week"
            value={`${view.reminders.responded}/${view.reminders.total}`}
            hint="reminders answered"
          />
          <Metric
            label="Journal"
            value={view.journalDays}
            hint={`day${view.journalDays === 1 ? '' : 's'} written`}
          />
        </div>
      </section>

      {word && (
        <BottomSheet
          title={word}
          subtitle={`${excerpts.length} mention${excerpts.length === 1 ? '' : 's'} in the last ${range} days`}
          onClose={() => setWord(null)}
        >
          <ul className="space-y-4">
            {excerpts.map((entry) => (
              <li key={entry.id} className="border-line border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="label">{formatDayKey(entry.day)}</span>
                  {entry.score === null ? (
                    <span className="chip bg-sunken text-ink-faint px-2.5 py-1 text-[11px]">
                      standalone
                    </span>
                  ) : (
                    <span
                      className={`chip ${WASH[entry.band]} ${textClassFor(entry.band)} px-2.5 py-1 text-[11px] font-medium tabular-nums`}
                      aria-label={`Score ${entry.score} out of 10`}
                    >
                      {entry.score}
                    </span>
                  )}
                </div>
                <p className="text-ink-soft mt-2 text-[15px] leading-relaxed">{entry.excerpt}</p>
              </li>
            ))}
          </ul>
        </BottomSheet>
      )}
    </Screen>
  )
}
