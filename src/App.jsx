/**
 * TEMPORARY setup verification screen.
 *
 * This is not part of Rainy — it just proves the toolchain and the data
 * layer work end to end. Delete this file's contents once real screens land.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, X, Loader, Moon, Sun, Mic, Wind, NotebookPen } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'
import {
  checkIns,
  brainDumps,
  breathingSessions,
  journalEntries,
  notificationSettings,
  relatedTo,
  standalone,
  addJournalItem,
  bandForScore,
  toDateKey,
  isPersistent,
  ValidationError,
} from './data'
import { resolvedTheme, setThemePreference } from './lib/theme.js'

async function runChecks() {
  const results = []
  const record = (name, fn) =>
    fn().then(
      (detail) => results.push({ name, ok: true, detail }),
      (error) => results.push({ name, ok: false, detail: error.message }),
    )

  // start from a clean slate so re-runs are identical
  await Promise.all([
    checkIns.clear(),
    brainDumps.clear(),
    breathingSessions.clear(),
    journalEntries.clear(),
    notificationSettings.reset(),
  ])

  let anchor = null

  await record('CheckIn — exact shape', async () => {
    anchor = await checkIns.create({ timeSlot: 'morning', score: 7 })
    const keys = Object.keys(anchor).sort().join(', ')
    if (keys !== 'id, score, timeSlot, timestamp') throw new Error(`unexpected fields: ${keys}`)
    if (anchor.timestamp !== new Date(anchor.timestamp).toISOString()) throw new Error('timestamp is not ISO8601')
    return `${keys} — band "${bandForScore(anchor.score)}"`
  })

  await record('CheckIn — score range and slots enforced', async () => {
    await checkIns.create({ timeSlot: 'night', score: 0 })
    await checkIns.create({ timeSlot: 'midday', score: 10 })
    for (const bad of [{ timeSlot: 'morning', score: 11 }, { timeSlot: 'afternoon', score: 5 }, { score: 5 }]) {
      try {
        await checkIns.create(bad)
        throw new Error(`accepted ${JSON.stringify(bad)}`)
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error
      }
    }
    return '0 and 10 accepted; 11, bad slot and missing score refused'
  })

  await record('BrainDump — linked to a check-in', async () => {
    const dump = await brainDumps.create({
      checkInId: anchor.id,
      text: 'Too many things at once',
      wordFrequencies: { too: 1, many: 1, things: 1 },
    })
    const keys = Object.keys(dump).sort().join(', ')
    if (keys !== 'checkInId, id, text, timestamp, wordFrequencies') throw new Error(`unexpected fields: ${keys}`)
    if (dump.wordFrequencies.many !== 1) throw new Error('wordFrequencies did not round-trip')
    return keys
  })

  await record('BrainDump — standalone, checkInId null', async () => {
    const dump = await brainDumps.create({ text: 'A thought on its own' })
    if (dump.checkInId !== null) throw new Error('checkInId should default to null')
    if (Object.keys(dump.wordFrequencies).length) throw new Error('wordFrequencies should default to {}')
    return 'checkInId null, wordFrequencies {}'
  })

  await record('BreathingSession — both modes', async () => {
    const box = await breathingSessions.create({ checkInId: anchor.id, mode: 'box', cyclesCompleted: 6 })
    const long = await breathingSessions.create({ mode: '478' })
    if (long.checkInId !== null) throw new Error('standalone session should have null checkInId')
    if (long.cyclesCompleted !== 0) throw new Error('cyclesCompleted should default to 0')
    try {
      await breathingSessions.create({ mode: '4-7-8' })
      throw new Error('an unknown mode was accepted')
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error
    }
    return `box (${box.cyclesCompleted} cycles) and 478; "4-7-8" refused`
  })

  await record('JournalEntry — date keyed, items appended', async () => {
    const today = toDateKey()
    const first = await addJournalItem('Slept badly', today)
    const second = await addJournalItem('Walked at lunch', today)
    if (second.items.length !== 2) throw new Error('second item did not append')
    if (second.id !== first.id) throw new Error('a second entry was created for the same day')
    if (second.createdAt !== first.createdAt) throw new Error('createdAt should not change')
    try {
      await journalEntries.create({ date: '09/09/2026' })
      throw new Error('a non ISO date was accepted')
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error
    }
    return `${today} — ${second.items.length} items, one entry`
  })

  await record('Linking — related vs standalone', async () => {
    const linked = await relatedTo(anchor.id)
    const loose = await standalone()
    if (linked.brainDumps.length !== 1 || linked.breathingSessions.length !== 1) {
      throw new Error('relatedTo did not find both records')
    }
    if (loose.brainDumps.length !== 1 || loose.breathingSessions.length !== 1) {
      throw new Error('standalone did not find the unlinked records')
    }
    return '1 dump + 1 session linked, 1 of each standalone'
  })

  await record('NotificationSettings — defaults and edits', async () => {
    const initial = await notificationSettings.get()
    const times = ['morning', 'midday', 'evening', 'night'].map((s) => initial[s].time).join(' ')
    if (times !== '08:00 12:00 17:00 21:00') throw new Error(`unexpected defaults: ${times}`)

    const edited = await notificationSettings.setSlot('morning', { time: '07:15' })
    if (edited.morning.time !== '07:15') throw new Error('time did not save')
    if (edited.morning.default !== '08:00') throw new Error('default should not change')
    if (edited.night.time !== '21:00') throw new Error('other slots should be untouched')

    await notificationSettings.setSlot('night', { enabled: false })
    const active = await notificationSettings.activeSlots()
    if (active.join(' ') !== 'morning midday evening') throw new Error(`unexpected active slots: ${active}`)

    try {
      await notificationSettings.setSlot('morning', { time: '25:00' })
      throw new Error('25:00 was accepted')
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error
    }
    return 'defaults correct, 07:15 saved, night off, 25:00 refused'
  })

  await record('Storage — spec-named keys', async () => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('rainy:v1:')).sort()
    const expected = [
      'rainy:v1:BRAIN_DUMPS',
      'rainy:v1:BREATHING_SESSIONS',
      'rainy:v1:CHECK_INS',
      'rainy:v1:JOURNAL_ENTRIES',
      'rainy:v1:NOTIFICATION_SETTINGS',
    ]
    for (const key of expected) {
      if (!keys.includes(key)) throw new Error(`missing ${key}`)
    }
    return expected.map((k) => k.replace('rainy:v1:', '')).join(', ')
  })

  await record('Survives a reload', async () => {
    if (!isPersistent()) throw new Error('this browser is blocking storage — data is memory-only')
    return 'localStorage is writable'
  })

  const chart = (await checkIns.list({ sort: { field: 'timestamp', direction: 'asc' } })).map((row, i) => ({
    i,
    score: row.score,
  }))

  // leave no test data behind
  await Promise.all([
    checkIns.clear(),
    brainDumps.clear(),
    breathingSessions.clear(),
    journalEntries.clear(),
    notificationSettings.reset(),
  ])

  return { results, chart }
}

const BANDS = [
  { key: 'low', score: 2, label: 'Settled', orb: 'orb-low', text: 'text-low', wash: 'bg-low-wash' },
  { key: 'medium', score: 5, label: 'Unsettled', orb: 'orb-med', text: 'text-med', wash: 'bg-med-wash' },
  { key: 'high', score: 9, label: 'Overwhelmed', orb: 'orb-high', text: 'text-high', wash: 'bg-high-wash' },
]

export default function App() {
  const [state, setState] = useState(null)
  const [mode, setMode] = useState(resolvedTheme)
  const [band, setBand] = useState(BANDS[0])
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // StrictMode runs effects twice in dev
    started.current = true
    runChecks().then(setState)
  }, [])

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    setThemePreference(next)
    setMode(next)
  }

  const passed = state?.results.filter((r) => r.ok).length ?? 0
  const total = state?.results.length ?? 0
  const allPassed = state && passed === total

  return (
    <>
      <div className="bloom-field" aria-hidden="true" />

      <div className="mx-auto min-h-dvh max-w-md px-5 pt-safe pb-safe">
        <header className="flex items-start justify-between pt-10 pb-10">
          <div>
            <p className="label">Setup check</p>
            <h1 className="mt-2 text-[28px] leading-none font-medium tracking-tight">Rainy</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="control"
            aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          >
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* the orb: how a level will read on the check-in screen */}
        <section className="flex flex-col items-center pb-10">
          <div className={`orb w-52 ${band.orb}`} />

          <p className="mt-8 text-xl font-medium tracking-tight">{band.label}</p>
          <p className="mt-1 text-sm text-ink-soft">
            Score {band.score} of 10 — band &ldquo;{bandForScore(band.score)}&rdquo;
          </p>

          {/* enough control, and no more: three plain choices */}
          <div className="mt-6 flex gap-2" role="group" aria-label="Anxiety level">
            {BANDS.map((b) => {
              const active = b.key === band.key
              return (
                <button
                  key={b.key}
                  onClick={() => setBand(b)}
                  aria-pressed={active}
                  className={`chip border transition-colors ${
                    active
                      ? `${b.wash} ${b.text} border-transparent`
                      : 'border-line text-ink-faint hover:text-ink-soft'
                  }`}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="sheet p-6">
          {!state ? (
            <div className="flex items-center gap-3 py-2 text-ink-soft">
              <Loader size={16} className="animate-spin" />
              <span className="text-sm">Running checks…</span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <p className="label">Data layer</p>
                <p className={`text-sm ${allPassed ? 'text-low' : 'text-high'}`}>
                  {passed} / {total}
                </p>
              </div>

              <div className="meter mt-3" role="presentation">
                <span style={{ width: `${total ? (passed / total) * 100 : 0}%` }} />
              </div>

              <ul className="mt-6 space-y-3.5">
                {state.results.map((result) => (
                  <li key={result.name} className="flex gap-3">
                    <span className={`mt-0.5 shrink-0 ${result.ok ? 'text-low' : 'text-high'}`}>
                      {result.ok ? <Check size={15} /> : <X size={15} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm">{result.name}</span>
                      <span className="block text-xs text-ink-faint">{result.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {state?.chart.length > 1 && (
          <section className="sheet mt-4 p-6">
            <p className="label">Recharts</p>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={80} debounce={0}>
                <LineChart data={state.chart} margin={{ top: 6, bottom: 6, left: 0, right: 0 }}>
                  <YAxis hide domain={[0, 10]} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={`var(--rainy-${band.key === 'medium' ? 'med' : band.key})`}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* the control row from the reference, mapped onto Rainy's actions */}
        <nav className="flex items-center justify-center gap-6 pt-12 pb-6">
          <button className="control" aria-label="Breathing"><Wind size={19} /></button>
          <button className="control control-primary" aria-label="Check in"><Mic size={22} /></button>
          <button className="control" aria-label="Journal"><NotebookPen size={19} /></button>
        </nav>

        <p className="pb-8 text-center text-xs text-ink-faint">
          Temporary screen — no real data is kept.
        </p>
      </div>
    </>
  )
}
