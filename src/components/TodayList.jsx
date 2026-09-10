/**
 * Everything logged today, newest first.
 *
 * A check-in shows its score; anything started on its own shows the icon
 * for what it was. Rows holding written text open in place.
 */

import { useState } from 'react'
import { PenLine, Wind, ChevronDown } from 'lucide-react'
import { prettyClock } from '../lib/time.js'
import { textClassFor } from '../lib/scoring.js'

const WASH = { low: 'bg-low-wash', medium: 'bg-med-wash', high: 'bg-high-wash' }

function Row({ entry }) {
  const [open, setOpen] = useState(false)

  // a check-in row opens too, when something was written alongside it
  const written = entry.kind === 'brainDump' ? entry.text : entry.brainDumps?.[0]?.text
  const expandable = Boolean(written)

  const marker =
    entry.kind === 'checkIn' ? (
      <span
        className={`chip ${WASH[entry.band]} ${textClassFor(entry.band)} px-3 py-1.5 font-medium tabular-nums`}
        aria-label={`Score ${entry.score} out of 10`}
      >
        {entry.score}
      </span>
    ) : (
      <span
        className="bg-sunken text-ink-soft grid size-8 place-items-center rounded-pill"
        aria-label={entry.kind === 'brainDump' ? 'Brain dump' : 'Breathing session'}
      >
        {entry.kind === 'brainDump' ? <PenLine size={15} /> : <Wind size={15} />}
      </span>
    )

  // what a check-in led to, so the row hints at what is inside
  const trail =
    entry.kind === 'checkIn' ? (
      <span className="text-ink-faint flex items-center gap-1.5">
        {entry.brainDumps?.length > 0 && <PenLine size={14} aria-label="Wrote it out" />}
        {entry.breathingSessions?.length > 0 && <Wind size={14} aria-label="Breathed" />}
      </span>
    ) : null

  const body = (
    <>
      <span className="label w-16 shrink-0 text-left">{prettyClock(entry.at)}</span>
      {marker}
      <span className="flex-1" />
      {trail}
      {expandable && (
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`text-ink-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      )}
    </>
  )

  return (
    <li className="border-line border-b last:border-b-0">
      {expandable ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            aria-expanded={open}
            className="flex w-full items-center gap-3 py-3.5 text-left"
          >
            {body}
          </button>
          {open && (
            <p className="text-ink-soft pb-4 text-[15px] leading-relaxed whitespace-pre-wrap">
              {written}
            </p>
          )}
        </>
      ) : (
        <div className="flex w-full items-center gap-3 py-3.5">{body}</div>
      )}
    </li>
  )
}

export default function TodayList({ entries }) {
  return (
    <ul className="mt-2">
      {entries.map((entry) => (
        <Row key={`${entry.kind}-${entry.id}`} entry={entry} />
      ))}
    </ul>
  )
}
