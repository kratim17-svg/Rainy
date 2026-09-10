/**
 * Word frequency analysis for brain dumps.
 *
 * Lowercase, strip punctuation, drop stop words, count what is left.
 * The result is stored on the BrainDump record as `wordFrequencies` and is
 * what the Insights screen will eventually read.
 */

/** Words carrying no signal — from the PRD. */
export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'is', 'it', 'i', 'my', 'me', 'was', 'are', 'be', 'been', 'this', 'that',
  'with', 'so', 'just', 'have', 'had', 'not', 'do', 'did', 'as', 'if', 'we',
  'you', 'he', 'she', 'they', 'all', 'its', 'from', 'by', 'about', 'no',
  'up', 'out', 'can', 'get',
])

/**
 * Count the meaningful words in a piece of text.
 *
 * Apostrophes close up, so "don't" counts as "dont" rather than leaving a
 * stray "t". Other punctuation separates, so "self-care" splits into two
 * words. Unicode-aware, so accented and non-Latin scripts survive.
 *
 * @param {string} text
 * @returns {{ [word: string]: number }} insertion-ordered, most recent last
 */
export function wordFrequencies(text) {
  if (!text) return {}

  const counts = {}
  const words = text
    .toLowerCase()
    // Apostrophes close up so contractions stay one word — including the
    // typographic one, which is what phone keyboards actually insert.
    // Everything else becomes a separator, so "self-care" splits in two.
    .replace(/['\u2018\u2019\u02bc]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)

  for (const word of words) {
    if (!word || STOP_WORDS.has(word)) continue
    counts[word] = (counts[word] ?? 0) + 1
  }

  return counts
}

/** The most frequent words first — for word clouds and summaries. */
export function topWords(frequencies, limit = 10) {
  return Object.entries(frequencies)
    .sort(([aWord, aCount], [bWord, bCount]) => bCount - aCount || aWord.localeCompare(bWord))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}
