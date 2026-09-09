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
  bandForLevel,
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
  await Promise.all([checkIns.clear(), brainDumps.clear(), breathingSessions.clear(), journalEntries.clear()])

  await record('CheckIn — create, read back', async () => {
    const made = await checkIns.create({ level: 4, triggers: ['work'], note: 'Tight chest' })
    const found = await checkIns.get(made.id)
    if (!found) throw new Error('could not read it back')
    if (found.level !== 4) throw new Error('level did not round-trip')
    if (!found.createdAt) throw new Error('no timestamp')
    return `id ${found.id.slice(0, 8)}…, band "${bandForLevel(found.level)}"`
  })

  await record('CheckIn — defaults applied', async () => {
    const made = await checkIns.create({ level: 1 })
    if (!Array.isArray(made.triggers) || made.triggers.length) throw new Error('triggers should default to []')
    if (made.note !== '') throw new Error('note should default to ""')
    if (!made.occurredAt) throw new Error('occurredAt should default to now')
    return 'triggers [], note "", occurredAt set'
  })

  await record('CheckIn — validation rejects bad input', async () => {
    try {
      await checkIns.create({ level: 9 })
    } catch (error) {
      if (error instanceof ValidationError) return error.message
      throw new Error('threw the wrong kind of error')
    }
    throw new Error('level 9 was accepted, but the range is 1–5')
  })

  await record('CheckIn — required field enforced', async () => {
    try {
      await checkIns.create({ note: 'no level given' })
    } catch (error) {
      if (error instanceof ValidationError) return error.message
      throw error
    }
    throw new Error('a check-in without a level was accepted')
  })

  await record('BrainDump — create, update, clear flag', async () => {
    const made = await brainDumps.create({ body: 'Too many tabs open in my head', tags: ['evening'] })
    if (made.cleared !== false) throw new Error('cleared should default to false')
    const updated = await brainDumps.update(made.id, { cleared: true })
    if (updated.cleared !== true) throw new Error('update did not stick')
    if (updated.createdAt !== made.createdAt) throw new Error('createdAt should never change')
    // two writes inside the same millisecond share a timestamp — that is fine,
    // it must simply never go backwards
    if (updated.updatedAt < made.createdAt) throw new Error('updatedAt went backwards')
    return 'created, patched, createdAt held'
  })

  await record('BreathingSession — create with oneOf field', async () => {
    const made = await breathingSessions.create({
      pattern: 'box',
      durationSeconds: 180,
      cyclesCompleted: 12,
      completed: true,
      levelBefore: 4,
      levelAfter: 2,
    })
    if (made.pattern !== 'box') throw new Error('pattern did not save')
    try {
      await breathingSessions.create({ pattern: 'freestyle', durationSeconds: 10 })
      throw new Error('an unknown pattern was accepted')
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error
    }
    return 'box accepted, unknown pattern refused'
  })

  await record('JournalEntry — create and list newest first', async () => {
    await journalEntries.create({ title: 'Older', body: 'First thing written' })
    await new Promise((r) => setTimeout(r, 5))
    await journalEntries.create({ title: 'Newer', body: 'Second thing written' })
    const rows = await journalEntries.list()
    if (rows.length !== 2) throw new Error(`expected 2 entries, found ${rows.length}`)
    if (rows[0].title !== 'Newer') throw new Error('list is not newest-first')
    return '2 entries, newest first'
  })

  await record('Query — limit, count and latest', async () => {
    const all = await checkIns.list()
    const one = await checkIns.list({ limit: 1 })
    const total = await checkIns.count()
    const last = await checkIns.latest()
    if (one.length !== 1) throw new Error('limit ignored')
    if (total !== all.length) throw new Error('count disagrees with list')
    if (last?.id !== all[0]?.id) throw new Error('latest is not the newest row')
    return `${total} check-ins stored`
  })

  await record('Delete — removes exactly one row', async () => {
    const made = await journalEntries.create({ body: 'temporary' })
    const before = await journalEntries.count()
    const removed = await journalEntries.remove(made.id)
    const after = await journalEntries.count()
    if (!removed || after !== before - 1) throw new Error('delete did not work')
    if (await journalEntries.remove('does-not-exist')) throw new Error('deleting a missing id returned true')
    return 'one removed, missing id returns false'
  })

  await record('Survives a reload', async () => {
    if (!isPersistent()) throw new Error('this browser is blocking storage — data is memory-only')
    return 'localStorage is writable'
  })

  const chart = (await checkIns.list({ sort: { field: 'createdAt', direction: 'asc' } })).map((row, i) => ({
    i,
    level: row.level,
  }))

  // leave no test data behind
  await Promise.all([checkIns.clear(), brainDumps.clear(), breathingSessions.clear(), journalEntries.clear()])

  return { results, chart }
}

const BANDS = [
  { key: 'low', label: 'Settled', orb: 'orb-low', text: 'text-low', wash: 'bg-low-wash' },
  { key: 'medium', label: 'Unsettled', orb: 'orb-med', text: 'text-med', wash: 'bg-med-wash' },
  { key: 'high', label: 'Overwhelmed', orb: 'orb-high', text: 'text-high', wash: 'bg-high-wash' },
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
          <p className="mt-1 text-sm text-ink-soft">How things feel right now</p>

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
                  <YAxis hide domain={[1, 5]} />
                  <Line
                    type="monotone"
                    dataKey="level"
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
