import { useEffect, useRef, useState } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import Screen from './Screen.jsx'
import {
  addJournalItem,
  journalEntries,
  journalFor,
  pastJournalEntries,
  removeJournalItem,
  toDateKey,
} from '../data/index.js'
import { formatDayKey, formatLongDate } from '../lib/time.js'

function PastEntry({ entry }) {
  const [open, setOpen] = useState(false)

  return (
    <li className="border-line border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="text-[15px]">{formatDayKey(entry.date)}</span>
        <span className="flex items-center gap-2.5">
          <span className="text-ink-faint text-[13px] tabular-nums">{entry.items.length}</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <ul className="space-y-1.5 pb-4">
          {entry.items.map((item, index) => (
            <li key={index} className="text-ink-soft text-[15px] leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function Journal() {
  const today = toDateKey()
  const inputRef = useRef(null)

  const [draft, setDraft] = useState('')
  const [items, setItems] = useState(null)
  const [past, setPast] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true

    const refresh = async () => {
      const [entry, earlier] = await Promise.all([journalFor(today), pastJournalEntries(today)])
      if (!live) return
      setItems(entry?.items ?? [])
      setPast(earlier)
    }

    refresh()
    const stop = journalEntries.subscribe(refresh)

    return () => {
      live = false
      stop()
    }
  }, [today])

  async function add(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return

    setBusy(true)
    setDraft('')
    await addJournalItem(text, today)
    setBusy(false)
    // keep the keyboard up for the next one
    inputRef.current?.focus()
  }

  async function remove(index) {
    if (busy) return
    setBusy(true)
    await removeJournalItem(index, today)
    setBusy(false)
  }

  return (
    <Screen label="Journal" title={formatLongDate(new Date())}>
      <p className="text-ink-soft mt-2 text-[15px]">What did you do for yourself today?</p>

      <form onSubmit={add} className="mt-6 flex items-center gap-2">
        <label htmlFor="item" className="sr-only">
          Add something you did for yourself
        </label>
        <input
          id="item"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add something"
          enterKeyHint="done"
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="btn btn-primary w-auto min-h-12 shrink-0 px-5"
        >
          <Plus size={17} aria-hidden="true" />
          Add
        </button>
      </form>

      {items === null ? null : items.length === 0 ? (
        <p className="text-ink-soft mt-8 text-[15px] leading-relaxed">
          Nothing yet. Even small things count.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="item-row">
              <span className="flex-1 text-[15px] leading-snug">{item}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${item}`}
                className="text-ink-faint hover:text-ink grid size-7 shrink-0 place-items-center rounded-pill transition-colors"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* hidden entirely until there is a past to look back on */}
      {past.length > 0 && (
        <section className="mt-12">
          <h2 className="label">Earlier days</h2>
          <ul className="mt-2">
            {past.map((entry) => (
              <PastEntry key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}
    </Screen>
  )
}
