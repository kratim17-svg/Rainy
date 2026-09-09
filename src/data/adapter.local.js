/**
 * localStorage adapter.
 *
 * This is the ONLY file that knows Rainy's data lives in the browser.
 * Everything above it talks to the adapter interface below, so moving to
 * Supabase later means writing one more file that implements these same
 * methods and pointing src/data/adapter.js at it. No screen code changes.
 *
 * The interface (all methods async, so a network-backed adapter drops in):
 *   list(collection, options)   -> Row[]
 *   get(collection, id)         -> Row | null
 *   insert(collection, row)     -> Row
 *   update(collection, id, patch) -> Row
 *   remove(collection, id)      -> boolean
 *   clear(collection)           -> void
 *   subscribe(collection, fn)   -> unsubscribe function
 */

const PREFIX = 'rainy'
const SCHEMA_VERSION = 1

const keyFor = (collection) => `${PREFIX}:v${SCHEMA_VERSION}:${collection}`

/* -------------------------------------------------------------------------
   Backing store

   Safari in private mode (and browsers with site data blocked) throw on
   localStorage access. Rather than crash, fall back to an in-memory store:
   the app keeps working for the session, it just will not persist.
------------------------------------------------------------------------- */

function detectStore() {
  try {
    const probe = `${PREFIX}:probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return { store: window.localStorage, persistent: true }
  } catch {
    const memory = new Map()
    return {
      persistent: false,
      store: {
        getItem: (k) => (memory.has(k) ? memory.get(k) : null),
        setItem: (k, v) => memory.set(k, String(v)),
        removeItem: (k) => memory.delete(k),
      },
    }
  }
}

const { store, persistent } = detectStore()

/** True when writes actually survive a page reload. */
export const isPersistent = () => persistent

/* ------------------------------------------------------------------------- */

export class StorageFullError extends Error {
  constructor() {
    super('There is no room left in this browser to save more entries.')
    this.name = 'StorageFullError'
  }
}

function readRaw(collection) {
  const raw = store.getItem(keyFor(collection))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Corrupted entry — better to start clean than to break every screen.
    console.warn(`[rainy] Could not read "${collection}"; resetting it.`)
    return []
  }
}

function writeRaw(collection, rows) {
  try {
    store.setItem(keyFor(collection), JSON.stringify(rows))
  } catch (error) {
    if (error?.name === 'QuotaExceededError' || error?.code === 22) {
      throw new StorageFullError()
    }
    throw error
  }
  notify(collection)
}

/* -------------------------------------------------------------------------
   Change notification

   Local listeners fire on our own writes. The `storage` event covers the
   other direction: Rainy open in a second tab stays in sync.
------------------------------------------------------------------------- */

const listeners = new Map() // collection -> Set<fn>

function notify(collection) {
  listeners.get(collection)?.forEach((fn) => {
    try {
      fn()
    } catch (error) {
      console.error('[rainy] A data listener threw:', error)
    }
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(`${PREFIX}:v${SCHEMA_VERSION}:`)) return
    notify(event.key.split(':').pop())
  })
}

function subscribe(collection, fn) {
  if (!listeners.has(collection)) listeners.set(collection, new Set())
  listeners.get(collection).add(fn)
  return () => listeners.get(collection)?.delete(fn)
}

/* -------------------------------------------------------------------------
   Query helpers

   `where` is a plain object of equality matches rather than a predicate
   function, because that is the shape that translates directly into a
   Supabase `.eq()` chain later.
------------------------------------------------------------------------- */

function matches(row, where) {
  return Object.entries(where).every(([field, expected]) =>
    Array.isArray(expected) ? expected.includes(row[field]) : row[field] === expected,
  )
}

function compare(a, b) {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  return a < b ? -1 : 1
}

/* ------------------------------------------------------------------------- */

export const localAdapter = {
  async list(collection, { where, sort, limit, offset = 0 } = {}) {
    let rows = readRaw(collection)

    if (where) rows = rows.filter((row) => matches(row, where))

    if (sort) {
      const { field, direction = 'desc' } = sort
      const sign = direction === 'asc' ? 1 : -1
      rows = [...rows].sort((a, b) => sign * compare(a[field], b[field]))
    }

    if (offset) rows = rows.slice(offset)
    if (limit !== undefined) rows = rows.slice(0, limit)

    return rows
  },

  async get(collection, id) {
    return readRaw(collection).find((row) => row.id === id) ?? null
  },

  async insert(collection, row) {
    const rows = readRaw(collection)
    rows.push(row)
    writeRaw(collection, rows)
    return row
  },

  async update(collection, id, patch) {
    const rows = readRaw(collection)
    const index = rows.findIndex((row) => row.id === id)
    if (index === -1) return null

    rows[index] = { ...rows[index], ...patch }
    writeRaw(collection, rows)
    return rows[index]
  },

  async remove(collection, id) {
    const rows = readRaw(collection)
    const remaining = rows.filter((row) => row.id !== id)
    if (remaining.length === rows.length) return false

    writeRaw(collection, remaining)
    return true
  },

  async clear(collection) {
    writeRaw(collection, [])
  },

  subscribe,
}
