/**
 * Reminders.
 *
 * A note on what is and is not possible here, because it shapes everything
 * below.
 *
 * The Web Push API does not let a page schedule its own future notification.
 * A push arrives because a *server* sent it, which means VAPID keys and a
 * backend that knows your times and wakes up to send at each one. Rainy has
 * no server — everything lives in this browser — so there is nothing to send
 * the push.
 *
 * What is wired up, and what it gets you:
 *
 *   permission      real, and required before anything else works
 *   showNotification real — fires immediately, used by the test button
 *   push handler    real, in sw.js, waiting for a server that can send
 *   scheduling      best effort, described below
 *
 * Scheduling falls back through three tiers:
 *
 *   1. Notification Triggers (`showTrigger`) — a real scheduled notification
 *      that fires with the app closed. Only ever shipped behind a flag, so it
 *      is feature-detected and used when present.
 *   2. Timers, while a tab is alive. Fires if the app is open or recently
 *      backgrounded; dies when the tab does.
 *   3. Nothing, until a push server exists.
 *
 * Point VITE_VAPID_PUBLIC_KEY at a server and subscribeToPush() starts
 * returning a subscription to hand it. No other code changes.
 */

import { notificationSettings, TIME_SLOTS } from '../data/index.js'
import { SLOT_LABELS } from './insights.js'

/** Where a tapped reminder lands. */
export const CHECK_IN_URL = '/check-in'

const ASKED_KEY = 'rainy:v1:notifications-asked'

/* ------------------------------------------------------------ capability */

export const supported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator

/** True background scheduling, where the browser offers it. */
export const canScheduleInBackground = () =>
  supported() && 'showTrigger' in Notification.prototype

/** @returns {'granted'|'denied'|'default'|'unsupported'} */
export const permission = () => (supported() ? Notification.permission : 'unsupported')

/** Whether the first-run request has been shown and answered. */
export function hasBeenAsked() {
  try {
    return localStorage.getItem(ASKED_KEY) === 'yes'
  } catch {
    return false
  }
}

export function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, 'yes')
  } catch {
    // storage blocked; the card reappears next launch, which is harmless
  }
}

/** Must be called from a tap — browsers refuse it otherwise. */
export async function requestPermission() {
  if (!supported()) return 'unsupported'
  markAsked()

  const result = await Notification.requestPermission()
  if (result === 'granted') await scheduleReminders()
  return result
}

/* -------------------------------------------------------------- sending */

async function registration() {
  if (!supported()) return null
  return navigator.serviceWorker.ready
}

/** Fire one now. Used by the test button in Settings. */
export async function sendTestNotification() {
  if (permission() !== 'granted') throw new Error('Reminders are not switched on.')

  const reg = await registration()
  if (!reg) throw new Error('The service worker is not running.')

  await reg.showNotification('Rainy', {
    body: 'This is what a check-in nudge looks like.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'rainy-test',
    data: { url: CHECK_IN_URL },
  })
}

/* ------------------------------------------------------------ scheduling */

/** The next time this HH:MM comes round, today or tomorrow. */
export function nextOccurrence(time, from = new Date()) {
  const [hours, minutes] = time.split(':').map(Number)
  const next = new Date(from)
  next.setHours(hours, minutes, 0, 0)
  if (next <= from) next.setDate(next.getDate() + 1)
  return next
}

/** Every enabled slot's next firing, soonest first. */
export async function upcomingReminders(from = new Date()) {
  const settings = await notificationSettings.get()

  return TIME_SLOTS.filter((slot) => settings[slot].enabled)
    .map((slot) => ({
      slot,
      label: SLOT_LABELS[slot],
      time: settings[slot].time,
      at: nextOccurrence(settings[slot].time, from),
    }))
    .sort((a, b) => a.at - b.at)
}

const timers = []

function clearTimers() {
  while (timers.length) clearTimeout(timers.pop())
}

const body = (label) => `${label} check-in. How are you feeling right now?`

/**
 * Put every enabled slot in place, by whichever tier this browser supports.
 * Safe to call repeatedly — it clears what it set last time first.
 *
 * @returns {Promise<{ tier: 'background'|'session'|'none', count: number }>}
 */
export async function scheduleReminders() {
  if (permission() !== 'granted') return { tier: 'none', count: 0 }

  const reg = await registration()
  if (!reg) return { tier: 'none', count: 0 }

  clearTimers()

  // drop anything previously scheduled so times can be edited
  for (const shown of await reg.getNotifications({ tag: 'rainy-reminder', includeTriggered: true })) {
    shown.close()
  }

  const upcoming = await upcomingReminders()

  if (canScheduleInBackground()) {
    for (const reminder of upcoming) {
      await reg.showNotification('Rainy', {
        body: body(reminder.label),
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'rainy-reminder',
        data: { url: CHECK_IN_URL, slot: reminder.slot },
        // eslint-disable-next-line no-undef
        showTrigger: new TimestampTrigger(reminder.at.getTime()),
      })
    }
    return { tier: 'background', count: upcoming.length }
  }

  // Fallback: only as long as this tab lives.
  const horizon = 12 * 60 * 60 * 1000
  let armed = 0

  for (const reminder of upcoming) {
    const delay = reminder.at.getTime() - Date.now()
    if (delay <= 0 || delay > horizon) continue

    timers.push(
      setTimeout(() => {
        reg.showNotification('Rainy', {
          body: body(reminder.label),
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'rainy-reminder',
          data: { url: CHECK_IN_URL, slot: reminder.slot },
        })
      }, delay),
    )
    armed += 1
  }

  return { tier: 'session', count: armed }
}

/* ------------------------------------------------------------- push prep */

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

/**
 * Subscribe this device to push, once a server exists to push from.
 *
 * Set VITE_VAPID_PUBLIC_KEY and POST the returned subscription to that
 * server; sw.js already knows how to render what it sends.
 *
 * @returns {Promise<PushSubscription|null>} null when no key is configured
 */
export async function subscribeToPush() {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!key || permission() !== 'granted') return null

  const reg = await registration()
  if (!reg?.pushManager) return null

  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })
}
