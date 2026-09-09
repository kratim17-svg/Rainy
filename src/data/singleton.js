/**
 * Notification settings.
 *
 * Not a collection — one object, four slots. It is stored as a single row so
 * the same adapter serves it, which keeps the Supabase swap to one file.
 *
 *   const settings = await notificationSettings.get()
 *   await notificationSettings.setSlot('morning', { time: '07:30' })
 *   await notificationSettings.setSlot('night', { enabled: false })
 */

import { adapter } from './adapter.js'
import {
  NOTIFICATION_COLLECTION as COLLECTION,
  TIME_SLOTS,
  notificationDefaults,
  validateNotificationSettings,
  ValidationError,
} from './schema.js'

const ROW_ID = 'settings'

/** Write the whole object, inserting the row the first time. */
async function save(settings) {
  const existing = await adapter.get(COLLECTION, ROW_ID)
  if (existing) return adapter.update(COLLECTION, ROW_ID, settings)
  return adapter.insert(COLLECTION, { id: ROW_ID, ...settings })
}

export const notificationSettings = {
  /**
   * The current settings, with defaults filled in for anything unset.
   * Always returns all four slots.
   */
  async get() {
    const row = await adapter.get(COLLECTION, ROW_ID)
    const defaults = notificationDefaults()
    if (!row) return defaults

    // merge slot by slot so a stored object written by an older version
    // still comes back complete
    const merged = {}
    for (const slot of TIME_SLOTS) {
      merged[slot] = { ...defaults[slot], ...(row[slot] ?? {}) }
    }
    return validateNotificationSettings(merged)
  },

  /**
   * Merge a patch into the settings. Slots left out are untouched.
   * @throws {ValidationError}
   */
  async update(patch = {}) {
    validateNotificationSettings(patch, { partial: true })

    const current = await this.get()
    const next = {}
    for (const slot of TIME_SLOTS) {
      next[slot] = { ...current[slot], ...(patch[slot] ?? {}) }
    }

    const settings = validateNotificationSettings(next)
    await save(settings)
    return settings
  },

  /**
   * Change one slot.
   * @param {'morning'|'midday'|'evening'|'night'} slot
   * @param {{ enabled?: boolean, time?: string }} patch
   */
  async setSlot(slot, patch = {}) {
    if (!TIME_SLOTS.includes(slot)) {
      throw new ValidationError([{ field: 'slot', message: `must be one of: ${TIME_SLOTS.join(', ')}` }])
    }
    return this.update({ [slot]: patch })
  },

  /** Put every slot back to its default time, enabled. */
  async reset() {
    const settings = notificationDefaults()
    await save(settings)
    return settings
  },

  /** The slots that should currently fire, in time order. */
  async activeSlots() {
    const settings = await this.get()
    return TIME_SLOTS.filter((slot) => settings[slot].enabled).sort((a, b) =>
      settings[a].time.localeCompare(settings[b].time),
    )
  },

  subscribe(fn) {
    return adapter.subscribe(COLLECTION, fn)
  },
}
