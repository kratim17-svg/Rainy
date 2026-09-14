/**
 * Aggregations behind the Insights tab.
 *
 * Everything here is a pure function over rows the data layer has already
 * fetched, so each one can be checked without a browser.
 */

import { TIME_SLOTS, bandForScore, toDateKey } from '../data/index.js'
import { wordFrequencies } from './words.js'

export const SLOT_LABELS = {
  morning: 'Morning',
  midday: 'Midday',
  evening: 'Evening',
  night: 'Night',
}

/** Reminders offered per day — one per slot. */
export const REMINDERS_PER_DAY = TIME_SLOTS.length

/** The day a record belongs to, in the device's own timezone. */
const dayOf = (isoOrDate) => toDateKey(new Date(isoOrDate))

const shiftDay = (key, days) => {
  const date = new Date(`${key}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/* ------------------------------------------------------------------ scores */

/**
 * Mean score per time slot, always all four in order.
 * `average` is null for a slot with nothing in it, so the chart leaves a gap
 * rather than drawing a zero — which would read as "very settled".
 */
export function averageByTimeSlot(checkIns) {
  return TIME_SLOTS.map((slot) => {
    const scores = checkIns.filter((row) => row.timeSlot === slot).map((row) => row.score)
    if (!scores.length) {
      return { slot, label: SLOT_LABELS[slot], average: null, count: 0, band: null }
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
    return {
      slot,
      label: SLOT_LABELS[slot],
      average: Math.round(average * 10) / 10,
      count: scores.length,
      band: bandForScore(average),
    }
  })
}

/** The slot with the highest mean, or null when nothing is logged. */
export function mostAnxiousSlot(averages) {
  const filled = averages.filter((row) => row.count > 0)
  if (!filled.length) return null
  return filled.reduce((worst, row) => (row.average > worst.average ? row : worst))
}

/* ------------------------------------------------------------------- words */

/**
 * Merge the word counts of every brain dump given.
 *
 * A dump that was never finished with Done has no stored frequencies, so its
 * text is counted here instead — it is still something that was on your mind.
 *
 * @returns {{word: string, count: number}[]} most frequent first
 */
export function aggregateWords(dumps) {
  const totals = {}

  for (const dump of dumps) {
    const counts =
      dump.wordFrequencies && Object.keys(dump.wordFrequencies).length
        ? dump.wordFrequencies
        : wordFrequencies(dump.text)

    for (const [word, count] of Object.entries(counts)) {
      totals[word] = (totals[word] ?? 0) + count
    }
  }

  return Object.entries(totals)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
}

/** Does this dump contain the word, per its counts or its text? */
function mentions(dump, word) {
  if (dump.wordFrequencies?.[word]) return true
  return Boolean(wordFrequencies(dump.text)[word])
}

/**
 * A readable window around the first mention, rather than a whole dump.
 * Falls back to the opening when the word cannot be located in the raw text —
 * punctuation is stripped when counting, so "dont" will not match "don't".
 */
export function excerptAround(text, word, radius = 90) {
  const at = text.toLowerCase().indexOf(word.toLowerCase())

  if (at === -1) {
    return text.length > radius * 2 ? `${text.slice(0, radius * 2).trimEnd()}…` : text
  }

  const from = Math.max(0, at - radius)
  const to = Math.min(text.length, at + word.length + radius)

  return `${from > 0 ? '…' : ''}${text.slice(from, to).trim()}${to < text.length ? '…' : ''}`
}

/**
 * Every dump mentioning a word, newest first, with the score of the check-in
 * it came from when it had one.
 *
 * @param {Map<string, number>} scoreByCheckIn
 */
export function excerptsFor(word, dumps, scoreByCheckIn) {
  return dumps
    .filter((dump) => mentions(dump, word))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .map((dump) => {
      const score = dump.checkInId ? (scoreByCheckIn.get(dump.checkInId) ?? null) : null
      return {
        id: dump.id,
        at: dump.timestamp,
        day: dayOf(dump.timestamp),
        score,
        band: score === null ? null : bandForScore(score),
        excerpt: excerptAround(dump.text, word),
      }
    })
}

/* ------------------------------------------------------------------ streaks */

/** Every day touched by anything at all. */
export function activeDayKeys({ checkIns = [], brainDumps = [], breathingSessions = [], journalEntries = [] }) {
  const days = new Set()
  for (const row of checkIns) days.add(dayOf(row.timestamp))
  for (const row of brainDumps) days.add(dayOf(row.timestamp))
  for (const row of breathingSessions) days.add(dayOf(row.timestamp))
  for (const row of journalEntries) if (row.items.length) days.add(row.date)
  return days
}

/**
 * Consecutive active days ending today.
 *
 * A quiet today does not break a run that is still going — the day is not
 * over yet, so the count carries on from yesterday. Two silent days end it.
 */
export function streakFrom(days, today = toDateKey()) {
  let cursor = today

  if (!days.has(cursor)) {
    cursor = shiftDay(today, -1)
    if (!days.has(cursor)) return 0
  }

  let run = 0
  while (days.has(cursor)) {
    run += 1
    cursor = shiftDay(cursor, -1)
  }
  return run
}

/**
 * How many of the window's reminders were answered.
 *
 * Counted as distinct day-and-slot pairs, so three check-ins in one morning
 * are one answered reminder, not three.
 */
export function remindersResponded(checkIns, days = 7) {
  const answered = new Set()
  for (const row of checkIns) answered.add(`${dayOf(row.timestamp)}|${row.timeSlot}`)

  const total = days * REMINDERS_PER_DAY
  return { responded: Math.min(answered.size, total), total }
}

/** Days that hold at least one journal item. */
export function journalDayCount(journalEntries) {
  return journalEntries.filter((entry) => entry.items.length > 0).length
}

/** Rows from the last `days` days, inclusive of today. */
export function withinDays(rows, days, field = 'timestamp', today = toDateKey()) {
  const from = shiftDay(today, -(days - 1))
  return rows.filter((row) => {
    const key = field === 'date' ? row.date : dayOf(row[field])
    return key >= from
  })
}
