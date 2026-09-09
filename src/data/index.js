/**
 * Rainy's data layer — the only data import screens should need.
 *
 *   import { checkIns, journalEntries, notificationSettings } from '../data'
 *
 *   const checkIn = await checkIns.create({ timeSlot: 'morning', score: 7 })
 *   await brainDumps.create({ checkInId: checkIn.id, text: 'Too much at once' })
 *   const recent = await checkIns.list({ limit: 7 })
 */

import { createRepository } from './collection.js'
import { notificationSettings } from './singleton.js'
import { schemas, toDateKey } from './schema.js'

export const checkIns = createRepository(schemas.checkIns)
export const brainDumps = createRepository(schemas.brainDumps)
export const breathingSessions = createRepository(schemas.breathingSessions)
export const journalEntries = createRepository(schemas.journalEntries)

export { notificationSettings }

/** Every collection repository, keyed by name. */
export const repositories = {
  checkIns,
  brainDumps,
  breathingSessions,
  journalEntries,
}

export {
  schemas,
  BANDS,
  TIME_SLOTS,
  BREATHING_MODES,
  SCORE_MIN,
  SCORE_MAX,
  SLOT_DEFAULT_TIMES,
  bandForScore,
  toDateKey,
  ValidationError,
} from './schema.js'
export { isPersistent, StorageFullError } from './adapter.js'

/* -------------------------------------------------------------------------
   Linking

   A brain dump or breathing session either follows a check-in or is started
   on its own, in which case checkInId stays null.
------------------------------------------------------------------------- */

/** Everything recorded off the back of one check-in. */
export async function relatedTo(checkInId) {
  const [dumps, sessions] = await Promise.all([
    brainDumps.list({ where: { checkInId } }),
    breathingSessions.list({ where: { checkInId } }),
  ])
  return { brainDumps: dumps, breathingSessions: sessions }
}

/** Brain dumps and breathing sessions started without a check-in. */
export async function standalone() {
  const [dumps, sessions] = await Promise.all([
    brainDumps.list({ where: { checkInId: null } }),
    breathingSessions.list({ where: { checkInId: null } }),
  ])
  return { brainDumps: dumps, breathingSessions: sessions }
}

/* -------------------------------------------------------------------------
   Journal

   One entry per calendar day, holding a list of items.
------------------------------------------------------------------------- */

/** The entry for a given day, or null. */
export async function journalFor(date = toDateKey()) {
  const [entry] = await journalEntries.list({ where: { date }, limit: 1 })
  return entry ?? null
}

/**
 * Append an item to a day's entry, creating the entry if it is the first.
 * @returns the saved entry
 */
export async function addJournalItem(text, date = toDateKey()) {
  const existing = await journalFor(date)
  if (!existing) return journalEntries.create({ date, items: [text] })
  return journalEntries.update(existing.id, { items: [...existing.items, text] })
}

/* -------------------------------------------------------------------------
   Backup

   Also the migration path: exportAll() produces exactly the shape a future
   Supabase importer would read.
------------------------------------------------------------------------- */

/** Every record in every collection, plus settings, as a plain object. */
export async function exportAll() {
  const data = {}
  for (const [name, repo] of Object.entries(repositories)) {
    data[name] = await repo.list({
      sort: { field: repo.schema.timestamps.created, direction: 'asc' },
    })
  }
  data.notificationSettings = await notificationSettings.get()

  return { app: 'rainy', version: 1, exportedAt: new Date().toISOString(), data }
}

/**
 * Restore an export. Replaces everything — take a backup first.
 * Records are written as-is, keeping their original ids and timestamps.
 */
export async function importAll(payload) {
  const data = payload?.data
  if (!data) throw new Error('That does not look like a Rainy backup file.')

  for (const [name, repo] of Object.entries(repositories)) {
    const rows = data[name]
    if (!Array.isArray(rows)) continue

    await repo.clear()
    for (const row of rows) {
      await repo.restore(row)
    }
  }

  if (data.notificationSettings) {
    await notificationSettings.update(data.notificationSettings)
  }
}

/** Wipe everything Rainy has stored. */
export async function clearAll() {
  for (const repo of Object.values(repositories)) {
    await repo.clear()
  }
  await notificationSettings.reset()
}
