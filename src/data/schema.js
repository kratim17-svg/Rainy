/**
 * Model definitions.
 *
 * This is the one file to edit when a model's fields change — the
 * repositories, defaults and validation all read from here.
 *
 * Every model automatically gets `id`, `createdAt` and `updatedAt`;
 * only list the fields specific to the model below.
 *
 * Field options:
 *   type      'string' | 'text' | 'integer' | 'number' | 'boolean'
 *             | 'string[]' | 'timestamp'
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
   The three anxiety bands, matching the accent colours in index.css.
------------------------------------------------------------------------- */

export const BANDS = ['low', 'medium', 'high']

/** Map a 1–5 anxiety level onto its band. */
export function bandForLevel(level) {
  if (level <= 2) return 'low'
  if (level === 3) return 'medium'
  return 'high'
}

/* ------------------------------------------------------------------------- */

export const schemas = {
  checkIns: {
    collection: 'checkIns',
    label: 'Check-in',
    fields: {
      // 1 = settled, 5 = overwhelmed. bandForLevel() turns this into a colour.
      level: { type: 'integer', required: true, min: 1, max: 5 },
      // when the feeling happened — may differ from when it was logged
      occurredAt: { type: 'timestamp', default: () => new Date().toISOString() },
      triggers: { type: 'string[]', default: () => [] },
      bodySignals: { type: 'string[]', default: () => [] },
      note: { type: 'text', default: '', max: 2000 },
    },
  },

  brainDumps: {
    collection: 'brainDumps',
    label: 'Brain dump',
    fields: {
      body: { type: 'text', required: true, max: 10000 },
      tags: { type: 'string[]', default: () => [] },
      // set once the thought has been sat with and let go of
      cleared: { type: 'boolean', default: false },
    },
  },

  breathingSessions: {
    collection: 'breathingSessions',
    label: 'Breathing session',
    fields: {
      pattern: { type: 'string', required: true, oneOf: ['box', '4-7-8', 'coherent', 'extended-exhale'] },
      durationSeconds: { type: 'integer', required: true, min: 0 },
      cyclesCompleted: { type: 'integer', default: 0, min: 0 },
      // false when the session was ended early — still worth recording
      completed: { type: 'boolean', default: false },
      levelBefore: { type: 'integer', default: null, min: 1, max: 5 },
      levelAfter: { type: 'integer', default: null, min: 1, max: 5 },
    },
  },

  journalEntries: {
    collection: 'journalEntries',
    label: 'Journal entry',
    fields: {
      title: { type: 'string', default: '', max: 200 },
      body: { type: 'text', required: true, max: 50000 },
      tags: { type: 'string[]', default: () => [] },
      // the reflection prompt this was written against, if any
      promptId: { type: 'string', default: null },
    },
  },
}

/* -------------------------------------------------------------------------
   Coercion and validation
------------------------------------------------------------------------- */

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

    case 'timestamp': {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        issues.push({ field, message: 'must be a valid date' })
        return null
      }
      return date.toISOString()
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

    if (spec.required && (value === null || value === '' )) {
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
