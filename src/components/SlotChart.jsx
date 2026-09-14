/**
 * Average score by time of day.
 *
 * Bars are tinted by band, but the value is printed above every bar as well.
 * That is deliberate: amber and rose sit only ~14 ΔE apart, which is below
 * the threshold where colour alone can be told apart, and amber against the
 * light surface is under 3:1. The numbers carry the meaning; colour reinforces.
 */

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SCORE_MAX } from '../data/index.js'

const FILL = {
  low: 'var(--rainy-low)',
  medium: 'var(--rainy-med)',
  high: 'var(--rainy-high)',
}

function ValueLabel({ x, y, width, value }) {
  if (value === null || value === undefined) return null
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      className="fill-ink text-[12px] font-medium tabular-nums"
    >
      {value.toFixed(1)}
    </text>
  )
}

function SlotTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  if (!row.count) return null

  return (
    <div className="sheet sheet-solid px-3 py-2 text-[12px]">
      <span className="font-medium">{row.label}</span>
      <span className="text-ink-faint">
        {' · '}
        {row.count} check-in{row.count === 1 ? '' : 's'}
      </span>
    </div>
  )
}

export default function SlotChart({ rows }) {
  return (
    <div className="mt-4 h-[165px]">
      <ResponsiveContainer width="100%" height="100%" debounce={0}>
        <BarChart data={rows} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--rainy-ink-faint)' }}
            dy={6}
          />
          <YAxis hide domain={[0, SCORE_MAX]} />
          <Tooltip content={<SlotTooltip />} cursor={false} />
          <Bar dataKey="average" radius={[4, 4, 0, 0]} maxBarSize={46} isAnimationActive={false}>
            <LabelList dataKey="average" content={<ValueLabel />} />
            {rows.map((row) => (
              <Cell key={row.slot} fill={row.band ? FILL[row.band] : 'var(--rainy-sunken)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
