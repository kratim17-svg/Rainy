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
