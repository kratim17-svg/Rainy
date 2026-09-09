/**
 * Builds a repository (create / list / get / update / remove) from a schema.
 *
 * Time fields differ per model: check-ins, brain dumps and breathing sessions
 * carry a single `timestamp`, while journal entries carry `createdAt` and
 * `updatedAt` because they are edited across a day. Each schema declares its
 * own via `timestamps`, and this factory maintains whichever it names.
 *
 * Everything returns a Promise even though localStorage is synchronous.
 * That is deliberate: screen code that already awaits these calls will not
 * need touching when the adapter becomes a network-backed one.
 */

import { adapter } from './adapter.js'
import { validate, ValidationError } from './schema.js'

/** RFC4122 id, with a fallback for browsers without a secure context. */
function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const now = () => new Date().toISOString()

export function createRepository(schema) {
  const { collection, timestamps } = schema
  const createdField = timestamps.created
  const updatedField = timestamps.updated ?? null
  const defaultSort = schema.defaultSort ?? { field: createdField, direction: 'desc' }

  return {
    schema,

    /**
     * Add a record. Missing fields fall back to their schema defaults.
     * @throws {ValidationError} when a required field is missing or invalid
     */
    async create(input = {}) {
      const fields = validate(schema, input)
      const stamp = now()

      const row = { id: newId(), ...fields, [createdField]: stamp }
      if (updatedField) row[updatedField] = stamp

      // an explicit time wins — used when logging something after the fact
      if (input[createdField] !== undefined && input[createdField] !== null) {
        const explicit = new Date(input[createdField])
        if (Number.isNaN(explicit.getTime())) {
          throw new ValidationError([{ field: createdField, message: 'must be a valid date' }])
        }
        row[createdField] = explicit.toISOString()
        if (updatedField) row[updatedField] = row[createdField]
      }

      return adapter.insert(collection, row)
    },

    /**
     * List records, newest first by default.
     * @param {{ where?: object, sort?: {field: string, direction?: 'asc'|'desc'},
     *           limit?: number, offset?: number }} [options]
     */
    async list(options = {}) {
      return adapter.list(collection, { sort: defaultSort, ...options })
    },

    /** One record by id, or null. */
    async get(id) {
      return adapter.get(collection, id)
    },

    /** Records timestamped within a range (inclusive start, exclusive end). */
    async between(start, end, options = {}) {
      const from = new Date(start).toISOString()
      const to = new Date(end).toISOString()
      const rows = await this.list(options)
      return rows.filter((row) => row[createdField] >= from && row[createdField] < to)
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
     * Models that track an updated time get it refreshed; the rest do not.
     * @throws {ValidationError}
     */
    async update(id, patch = {}) {
      const fields = validate(schema, patch, { partial: true })
      if (updatedField) fields[updatedField] = now()
      return adapter.update(collection, id, fields)
    },

    /**
     * Insert a record exactly as given, keeping its existing id and
     * timestamps. Used when restoring a backup — not for normal writes.
     * @throws {ValidationError}
     */
    async restore(row = {}) {
      const fields = validate(schema, row)
      const stamp = now()

      const restored = { ...fields, id: row.id ?? newId(), [createdField]: row[createdField] ?? stamp }
      if (updatedField) restored[updatedField] = row[updatedField] ?? restored[createdField]

      return adapter.insert(collection, restored)
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
