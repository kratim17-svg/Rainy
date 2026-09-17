import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import FocusHeader from '../components/FocusHeader.jsx'
import {
  exportAll,
  notificationSettings,
  toDateKey,
  TIME_SLOTS,
} from '../data/index.js'
import { SLOT_LABELS } from '../lib/insights.js'

const VERSION = __APP_VERSION__

/** Singular; an s is added when the count calls for one. */
const COUNT_LABELS = {
  checkIns: 'check-in',
  brainDumps: 'brain dump',
  breathingSessions: 'breathing session',
  journalEntries: 'journal day',
}

export default function Settings() {
  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(null)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exported, setExported] = useState(null)

  useEffect(() => {
    let live = true
    notificationSettings.get().then((settings) => {
      if (!live) return
      setDraft(settings)
      setSaved(settings)
    })
    return () => {
      live = false
    }
  }, [])

  if (!draft) return <FocusHeader />

  const edit = (slot, patch) => {
    setDraft({ ...draft, [slot]: { ...draft[slot], ...patch } })
    setStatus(null)
  }

  const incomplete = TIME_SLOTS.some((slot) => !draft[slot].time)
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)

  async function save() {
    if (busy || !changed || incomplete) return
    setBusy(true)
    try {
      const next = await notificationSettings.update(draft)
      setSaved(next)
      setDraft(next)
      setStatus({ ok: true, message: 'Reminders saved' })
    } catch (cause) {
      setStatus({ ok: false, message: cause.message })
    }
    setBusy(false)
  }

  async function exportData() {
    setBusy(true)
    try {
      const payload = await exportAll()
      const name = `rainy-${toDateKey()}.json`

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      const summary = Object.entries(COUNT_LABELS)
        .map(([key, label]) => {
          const total = payload.data[key]?.length ?? 0
          return `${total} ${label}${total === 1 ? '' : 's'}`
        })
        .join(' · ')

      setExported({ ok: true, name, summary })
    } catch (cause) {
      setExported({ ok: false, name: cause.message })
    }
    setBusy(false)
  }

  return (
    <>
      <FocusHeader />

      <main className="pb-safe flex flex-1 flex-col px-5 pb-10">
        <p className="label">Settings</p>
        <h1 className="mt-2 text-[26px] leading-tight font-medium tracking-tight">Reminders</h1>
        <p className="text-ink-soft mt-2 text-[15px] leading-relaxed">
          Four gentle nudges a day. Turn off any you don&rsquo;t want.
        </p>

        <section className="sheet mt-6 divide-y divide-[var(--rainy-line)] px-5">
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot}
              className={`flex items-center gap-3 py-4 transition-opacity ${
                draft[slot].enabled ? '' : 'opacity-55'
              }`}
            >
              <label htmlFor={`time-${slot}`} className="flex-1 text-[15px]">
                {SLOT_LABELS[slot]}
              </label>

              <input
                id={`time-${slot}`}
                type="time"
                value={draft[slot].time}
                onChange={(event) => edit(slot, { time: event.target.value })}
                className="time-input"
              />

              <button
                type="button"
                role="switch"
                aria-checked={draft[slot].enabled}
                aria-label={`${SLOT_LABELS[slot]} reminder`}
                onClick={() => edit(slot, { enabled: !draft[slot].enabled })}
                className="switch"
              >
                <span />
              </button>
            </div>
          ))}
        </section>

        {incomplete && (
          <p className="text-high mt-3 text-[13px]">Every reminder needs a time.</p>
        )}
        {status && (
          <p
            role="status"
            className={`mt-3 text-[13px] ${status.ok ? 'text-low' : 'text-high'}`}
          >
            {status.message}
          </p>
        )}

        <button
          type="button"
          onClick={save}
          disabled={!changed || incomplete || busy}
          className="btn btn-primary mt-4"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>

        {/* ------------------------------------------------------------- */}

        <h2 className="mt-12 text-[22px] leading-tight font-medium tracking-tight">Data</h2>
        <p className="text-ink-soft mt-2 text-[15px] leading-relaxed">
          Everything Rainy holds lives on this device. Take a copy whenever you like.
        </p>

        <button type="button" onClick={exportData} disabled={busy} className="btn btn-soft mt-4">
          <Download size={17} aria-hidden="true" />
          Export my data
        </button>

        {exported && (
          <p
            role="status"
            className={`mt-3 text-[13px] ${exported.ok ? 'text-ink-faint' : 'text-high'}`}
          >
            {exported.ok ? (
              <>
                Saved as {exported.name}
                <br />
                {exported.summary}
              </>
            ) : (
              exported.name
            )}
          </p>
        )}

        {/* ------------------------------------------------------------- */}

        <h2 className="mt-12 text-[22px] leading-tight font-medium tracking-tight">About</h2>
        <div className="sheet mt-4 p-5">
          <p className="text-[17px] font-medium tracking-tight">Rainy</p>
          <p className="label mt-1">Version {VERSION}</p>
          <p className="text-ink-soft mt-3 text-[15px] leading-relaxed">
            Built for your healing journey.
          </p>
        </div>
      </main>
    </>
  )
}
