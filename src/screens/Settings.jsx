import { useEffect, useState } from 'react'
import { Bell, BellOff, Download, Send } from 'lucide-react'
import FocusHeader from '../components/FocusHeader.jsx'
import {
  exportAll,
  notificationSettings,
  toDateKey,
  TIME_SLOTS,
} from '../data/index.js'
import { SLOT_LABELS } from '../lib/insights.js'
import {
  canScheduleInBackground,
  permission as notificationPermission,
  requestPermission,
  scheduleReminders,
  sendTestNotification,
  supported as notificationsSupported,
} from '../lib/notifications.js'

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
  const [perm, setPerm] = useState(notificationPermission)
  const [tested, setTested] = useState(null)

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
      const armed = await scheduleReminders()
      setStatus({
        ok: true,
        message:
          armed.tier === 'background'
            ? 'Reminders saved and scheduled'
            : armed.tier === 'session'
              ? `Reminders saved · ${armed.count} armed while Rainy is open`
              : 'Reminders saved',
      })
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

  async function askPermission() {
    setBusy(true)
    setPerm(await requestPermission())
    setBusy(false)
  }

  async function test() {
    setBusy(true)
    try {
      await sendTestNotification()
      setTested({ ok: true, message: 'Sent — check your notification shade' })
    } catch (cause) {
      setTested({ ok: false, message: cause.message })
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

        {notificationsSupported() && (
          <div className="sheet mt-3 p-5">
            <div className="flex items-center gap-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-pill ${
                  perm === 'granted' ? 'bg-low-wash text-low' : 'bg-sunken text-ink-faint'
                }`}
              >
                {perm === 'granted' ? <Bell size={16} /> : <BellOff size={16} />}
              </span>
              <p className="flex-1 text-[14px] leading-snug">
                {perm === 'granted'
                  ? 'Notifications are on for this device.'
                  : perm === 'denied'
                    ? 'Notifications are blocked in your browser settings.'
                    : 'Notifications are not switched on yet.'}
              </p>
            </div>

            {perm === 'granted' && !canScheduleInBackground() && (
              <p className="text-ink-faint mt-3 text-[13px] leading-relaxed">
                This browser can only fire reminders while Rainy is open. Delivery when the
                app is closed needs a push server — see the README.
              </p>
            )}

            {perm === 'default' && (
              <button
                type="button"
                onClick={askPermission}
                disabled={busy}
                className="btn btn-soft mt-4 min-h-11"
              >
                Turn on notifications
              </button>
            )}

            {perm === 'granted' && (
              <button
                type="button"
                onClick={test}
                disabled={busy}
                className="btn btn-soft mt-4 min-h-11"
              >
                <Send size={16} aria-hidden="true" />
                Send a test notification
              </button>
            )}

            {tested && (
              <p
                role="status"
                className={`mt-3 text-[13px] ${tested.ok ? 'text-low' : 'text-high'}`}
              >
                {tested.message}
              </p>
            )}
          </div>
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
