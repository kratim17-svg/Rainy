/**
 * The 0-10 scale: eleven dots, each tinted by the band it falls in, so the
 * shape of the scale is visible before anything is chosen.
 */

import { bandForScore, dotClassFor } from '../lib/scoring.js'

const SCORES = Array.from({ length: 11 }, (_, i) => i)

export default function ScoreScale({ value, onChange }) {
  return (
    <div role="group" aria-label="Anxiety score from 0 to 10">
      <div className="flex items-center">
        {SCORES.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            aria-pressed={value === score}
            aria-label={`${score} out of 10`}
            className={dotClassFor(bandForScore(score))}
          >
            <span />
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-between">
        <span className="label">Settled</span>
        <span className="label">Overwhelmed</span>
      </div>
    </div>
  )
}
