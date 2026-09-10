/**
 * What a score means to the interface.
 *
 * Two separate thresholds, deliberately kept apart:
 *
 *   colour  bandForScore() splits 0-3 / 4-6 / 7-10 (green / amber / rose)
 *   support needsSupport() splits at 6
 *
 * So a 6 is amber and still offers support. That is intended, not a bug.
 */

export { bandForScore } from '../data/index.js'

/** At or above this, offer to write it out or breathe. */
export const SUPPORT_THRESHOLD = 6

export const needsSupport = (score) => score >= SUPPORT_THRESHOLD

/** Maps a band onto the class that tints the score dots. */
export const dotClassFor = (band) =>
  band === 'high' ? 'dot dot-high' : band === 'medium' ? 'dot dot-med' : 'dot'

/** Maps a band onto its text colour utility. */
export const textClassFor = (band) =>
  band === 'high' ? 'text-high' : band === 'medium' ? 'text-med' : 'text-low'
