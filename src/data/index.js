/**
 * Rainy's data layer — the only data import screens should need.
 *
 *   import { checkIns, journalEntries } from '../data'
 *
 *   await checkIns.create({ level: 4, triggers: ['work'], note: 'Tight chest' })
 *   const recent = await checkIns.list({ limit: 7 })
 */

import { createRepository } from './collection.js'
import { schemas } from './schema.js'

export const checkIns = createRepository(schemas.checkIns)
export const brainDumps = createRepository(schemas.brainDumps)
export const breathingSessions = createRepository(schemas.breathingSessions)
export const journalEntries = createRepository(schemas.journalEntries)

/** Every repository, keyed by collection name. */
export const repositories = {
  checkIns,
  brainDumps,
  breathingSessions,
  journalEntries,
}

export { schemas, BANDS, bandForLevel, ValidationError } from './schema.js'
export { isPersistent, StorageFullError } from './adapter.js'

/* -------------------------------------------------------------------------
   Backup

   Also the migration path: exportAll() produces exactly the shape a future
   Supabase importer would read.
------------------------------------------------------------------------- */

/** Every record in every collection, as a plain object. */
export async function exportAll() {
  const data = {}
  for (const [name, repo] of Object.entries(repositories)) {
    data[name] = await repo.list({ sort: { field: 'createdAt', direction: 'asc' } })
  }
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
}

/** Wipe everything Rainy has stored. */
export async function clearAll() {
  for (const repo of Object.values(repositories)) {
    await repo.clear()
  }
}
