/**
 * Builds a repository (create / list / get / update / remove) from a schema.
 *
 * Everything returns a Promise even though localStorage is synchronous.
 * That is deliberate: screen code that already awaits these calls will not
 * need touching when the adapter becomes a network-backed one.
 */

import { adapter } from './adapter.js'
import { validate } from './schema.js'

/** RFC4122 id, with a fallback for browsers without a secure context. */
function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const now = () => new Date().toISOString()

export function createRepository(schema) {
  const { collection } = schema

  return {
    schema,

    /**
     * Add a record. Missing fields fall back to their schema defaults.
     * @throws {ValidationError} when a required field is missing or invalid
     */
    async create(input = {}) {
      const fields = validate(schema, input)
      const timestamp = now()

      return adapter.insert(collection, {
        id: newId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...fields,
      })
    },

    /**
     * List records, newest first by default.
     * @param {{ where?: object, sort?: {field: string, direction?: 'asc'|'desc'},
     *           limit?: number, offset?: number }} [options]
     */
    async list(options = {}) {
      return adapter.list(collection, {
        sort: { field: 'createdAt', direction: 'desc' },
        ...options,
      })
    },

    /** One record by id, or null. */
    async get(id) {
      return adapter.get(collection, id)
    },

    /** Records created within a date range (inclusive start, exclusive end). */
    async between(start, end, options = {}) {
      const from = new Date(start).toISOString()
      const to = new Date(end).toISOString()
      const rows = await this.list(options)
      return rows.filter((row) => row.createdAt >= from && row.createdAt < to)
    },

    /** The most recent record, or null. */
    async latest() {
      const [row] = await this.list({ limit: 1 })
      return row ?? null
    },

    async count(where) {
      return (await this.list(where ? { where } : undefined)).length
    },

    /**
     * Patch a record. Only the fields supplied are validated and changed.
     * @throws {ValidationError}
     */
    async update(id, patch = {}) {
      const fields = validate(schema, patch, { partial: true })
      return adapter.update(collection, id, { ...fields, updatedAt: now() })
    },

    /**
     * Insert a record exactly as given, keeping its existing id and
     * timestamps. Used when restoring a backup — not for normal writes.
     * @throws {ValidationError}
     */
    async restore(row = {}) {
      const fields = validate(schema, row)
      const timestamp = now()

      return adapter.insert(collection, {
        ...fields,
        id: row.id ?? newId(),
        createdAt: row.createdAt ?? timestamp,
        updatedAt: row.updatedAt ?? row.createdAt ?? timestamp,
      })
    },

    /** @returns {boolean} false when there was nothing to delete. */
    async remove(id) {
      return adapter.remove(collection, id)
    },

    /** Delete every record in this collection. */
    async clear() {
      return adapter.clear(collection)
    },

    /**
     * Run `fn` whenever this collection changes, including from another tab.
     * @returns {() => void} call to stop listening
     */
    subscribe(fn) {
      return adapter.subscribe(collection, fn)
    },
  }
}
