/**
 * Time of day.
 *
 * The slot boundaries line up with the default reminder times in
 * SLOT_DEFAULT_TIMES, so a check-in nudged at 08:00 is filed as "morning".
 */

/** @returns {'morning'|'midday'|'evening'|'night'} */
export function slotForDate(date = new Date()) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'midday'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

const GREETINGS = {
  morning: 'Good morning',
  midday: 'Good afternoon',
  evening: 'Good evening',
  // still "evening" out loud — "good night" reads as a goodbye
  night: 'Good evening',
}

export function greetingFor(date = new Date()) {
  return GREETINGS[slotForDate(date)]
}

/** e.g. "Tuesday, 9 September" — follows the device's locale. */
export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** "17:00" -> "5pm", "07:30" -> "7:30am" */
export function prettyTime(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const period = hours < 12 ? 'am' : 'pm'
  const hour = hours % 12 === 0 ? 12 : hours % 12
  return minutes === 0 ? `${hour}${period}` : `${hour}:${String(minutes).padStart(2, '0')}${period}`
}

/** "2:14 pm" — follows the device's locale, lowercased to sit quietly. */
export function prettyClock(isoOrDate) {
  return new Date(isoOrDate)
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
}

/**
 * The next reminder due, from the notification settings.
 *
 * @param {object} settings the four slots
 * @returns {{ time: string, tomorrow: boolean } | null} null when every
 *          slot is switched off
 */
export function nextReminder(settings, now = new Date()) {
  const times = Object.values(settings)
    .filter((slot) => slot.enabled)
    .map((slot) => slot.time)
    .sort()

  if (!times.length) return null

  const pad = (n) => String(n).padStart(2, '0')
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const upcoming = times.find((time) => time > clock)

  // nothing left today, so the first slot tomorrow
  return { time: upcoming ?? times[0], tomorrow: !upcoming }
}
