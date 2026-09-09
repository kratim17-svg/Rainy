/**
 * Model definitions.
 *
 * This is the one file to edit when a model's fields change — the
 * repositories, defaults and validation all read from here.
 *
 * Each schema declares:
 *   collection  the localStorage key suffix (rainy:v1:CHECK_INS)
 *   timestamps  which time fields the repository maintains automatically
 *   fields      everything else
 *
 * Field options:
 *   type      'string' | 'text' | 'integer' | 'number' | 'boolean'
 *             | 'string[]' | 'counts' | 'timestamp' | 'date' | 'time'
 *   required  reject a create that omits it
 *   default   value, or a function returning one, used when omitted
 *   min/max   numbers: range check. strings/arrays: length check.
 *   oneOf     allowed values
 */

export class ValidationError extends Error {
  constructor(issues) {
    super(issues.map((i) => `${i.field}: ${i.message}`).join('; '))
    this.name = 'ValidationError'
    this.issues = issues
  }
}

/* -------------------------------------------------------------------------
   Shared vocabulary
------------------------------------------------------------------------- */

/** The four daily windows. Also the keys of NOTIFICATION_SETTINGS. */
export const TIME_SLOTS = ['morning', 'midday', 'evening', 'night']

export const BREATHING_MODES = ['box', '478']

export const SCORE_MIN = 0
export const SCORE_MAX = 10

/** The three accent colours in index.css. */
export const BANDS = ['low', 'medium', 'high']

/**
 * Map a 0–10 check-in score onto its colour band.
 * The cut points are a judgement call — change them here and every screen
 * follows.
 */
export function bandForScore(score) {
  if (score <= 3) return 'low'
  if (score <= 6) return 'medium'
  return 'high'
}

/** Local YYYY-MM-DD for a Date — not toISOString(), which shifts to UTC. */
export function toDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/* -------------------------------------------------------------------------
   Collections
------------------------------------------------------------------------- */

export const schemas = {
  checkIns: {
    collection: 'CHECK_INS',
    label: 'Check-in',
    timestamps: { created: 'timestamp' },
    fields: {
      timeSlot: { type: 'string', required: true, oneOf: TIME_SLOTS },
      score: { type: 'number', required: true, min: SCORE_MIN, max: SCORE_MAX },
    },
  },

  brainDumps: {
    collection: 'BRAIN_DUMPS',
    label: 'Brain dump',
    timestamps: { created: 'timestamp' },
    fields: {
      // null when started on its own rather than from a check-in
      checkInId: { type: 'string', default: null },
      text: { type: 'text', required: true, max: 20000 },
      wordFrequencies: { type: 'counts', default: () => ({}) },
    },
  },

  breathingSessions: {
    collection: 'BREATHING_SESSIONS',
    label: 'Breathing session',
    timestamps: { created: 'timestamp' },
    fields: {
      checkInId: { type: 'string', default: null },
      mode: { type: 'string', required: true, oneOf: BREATHING_MODES },
      cyclesCompleted: { type: 'number', default: 0, min: 0 },
    },
  },

  journalEntries: {
    collection: 'JOURNAL_ENTRIES',
    label: 'Journal entry',
    // the only model that tracks both — entries are edited across a day
    timestamps: { created: 'createdAt', updated: 'updatedAt' },
    // list by the day described, not the moment first written
    defaultSort: { field: 'date', direction: 'desc' },
    fields: {
      date: { type: 'date', required: true },
      items: { type: 'string[]', default: () => [] },
    },
  },
}

/* -------------------------------------------------------------------------
   Notification settings — one object, not a collection
------------------------------------------------------------------------- */

export const NOTIFICATION_COLLECTION = 'NOTIFICATION_SETTINGS'

/** The times each slot falls back to, per the spec. */
export const SLOT_DEFAULT_TIMES = {
  morning: '08:00',
  midday: '12:00',
  evening: '17:00',
  night: '21:00',
}

/**
 * Reminders start on. They cannot actually fire until the browser grants
 * notification permission, so this is a preference rather than an intrusion.
 */
export const notificationDefaults = () =>
  Object.fromEntries(
    TIME_SLOTS.map((slot) => [
      slot,
      { enabled: true, time: SLOT_DEFAULT_TIMES[slot], default: SLOT_DEFAULT_TIMES[slot] },
    ]),
  )

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Validate a whole settings object. Unlike the collections this shape is
 * nested and fixed, so it gets a purpose-built check rather than the
 * generic field walker.
 *
 * @param {object} input
 * @param {{ partial?: boolean }} [options] partial keeps slots that are absent
 * @throws {ValidationError}
 */
export function validateNotificationSettings(input, { partial = false } = {}) {
  const issues = []
  const settings = {}

  for (const slot of TIME_SLOTS) {
    const supplied = input?.[slot]

    if (supplied === undefined || supplied === null) {
      if (partial) continue
      settings[slot] = {
        enabled: true,
        time: SLOT_DEFAULT_TIMES[slot],
        default: SLOT_DEFAULT_TIMES[slot],
      }
      continue
    }

    if (typeof supplied !== 'object' || Array.isArray(supplied)) {
      issues.push({ field: slot, message: 'must be an object' })
      continue
    }

    const time = supplied.time ?? SLOT_DEFAULT_TIMES[slot]
    if (typeof time !== 'string' || !TIME_PATTERN.test(time)) {
      issues.push({ field: `${slot}.time`, message: 'must be a 24-hour HH:MM time' })
      continue
    }

    settings[slot] = {
      enabled: supplied.enabled === undefined ? true : Boolean(supplied.enabled),
      time,
      default: SLOT_DEFAULT_TIMES[slot],
    }
  }

  const unknown = Object.keys(input ?? {}).filter((key) => !TIME_SLOTS.includes(key))
  if (unknown.length) {
    issues.push({ field: unknown[0], message: `is not one of: ${TIME_SLOTS.join(', ')}` })
  }

  if (issues.length) throw new ValidationError(issues)
  return settings
}

/* -------------------------------------------------------------------------
   Coercion and validation
------------------------------------------------------------------------- */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function coerce(value, spec, field, issues) {
  if (value === null || value === undefined) return null

  switch (spec.type) {
    case 'string':
    case 'text': {
      const out = String(value).trim()
      if (spec.max !== undefined && out.length > spec.max) {
        issues.push({ field, message: `must be ${spec.max} characters or fewer` })
      }
      return out
    }

    case 'integer':
    case 'number': {
      const out = spec.type === 'integer' ? Math.round(Number(value)) : Number(value)
      if (!Number.isFinite(out)) {
        issues.push({ field, message: 'must be a number' })
        return null
      }
      if (spec.min !== undefined && out < spec.min) {
        issues.push({ field, message: `must be ${spec.min} or more` })
      }
      if (spec.max !== undefined && out > spec.max) {
        issues.push({ field, message: `must be ${spec.max} or less` })
      }
      return out
    }

    case 'boolean':
      return Boolean(value)

    case 'string[]': {
      if (!Array.isArray(value)) {
        issues.push({ field, message: 'must be a list' })
        return []
      }
      return value.map((v) => String(v).trim()).filter(Boolean)
    }

    /* { word: count } — the shape produced by counting a brain dump */
    case 'counts': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        issues.push({ field, message: 'must be an object of word counts' })
        return {}
      }
      const out = {}
      for (const [word, count] of Object.entries(value)) {
        const n = Number(count)
        if (!Number.isFinite(n)) {
          issues.push({ field: `${field}.${word}`, message: 'must be a number' })
          continue
        }
        out[word] = n
      }
      return out
    }

    case 'timestamp': {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        issues.push({ field, message: 'must be a valid date' })
        return null
      }
      return date.toISOString()
    }

    /* calendar day, kept as written — converting via Date would shift zones */
    case 'date': {
      const out = String(value).trim()
      if (!DATE_PATTERN.test(out) || Number.isNaN(new Date(`${out}T00:00:00`).getTime())) {
        issues.push({ field, message: 'must be a YYYY-MM-DD date' })
        return null
      }
      return out
    }

    case 'time': {
      const out = String(value).trim()
      if (!TIME_PATTERN.test(out)) {
        issues.push({ field, message: 'must be a 24-hour HH:MM time' })
        return null
      }
      return out
    }

    default:
      return value
  }
}

const defaultFor = (spec) => (typeof spec.default === 'function' ? spec.default() : spec.default)

/**
 * Validate input against a schema.
 *
 * @param {object} schema  one of the entries in `schemas`
 * @param {object} input   the raw values
 * @param {{ partial?: boolean }} [options]  partial skips required checks and
 *        only returns the fields actually supplied — used by update()
 * @returns {object} the coerced record
 * @throws {ValidationError}
 */
export function validate(schema, input, { partial = false } = {}) {
  const issues = []
  const record = {}

  for (const [field, spec] of Object.entries(schema.fields)) {
    const supplied = Object.prototype.hasOwnProperty.call(input, field)

    if (!supplied) {
      if (partial) continue
      if (spec.required) {
        issues.push({ field, message: 'is required' })
        continue
      }
      record[field] = spec.default === undefined ? null : defaultFor(spec)
      continue
    }

    const value = coerce(input[field], spec, field, issues)

    if (spec.required && (value === null || value === '')) {
      issues.push({ field, message: 'is required' })
      continue
    }

    if (spec.oneOf && value !== null && !spec.oneOf.includes(value)) {
      issues.push({ field, message: `must be one of: ${spec.oneOf.join(', ')}` })
      continue
    }

    record[field] = value
  }

  if (issues.length) throw new ValidationError(issues)
  return record
}
