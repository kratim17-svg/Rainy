import { useSearchParams } from 'react-router'

/** Placeholder. The check-in it came from is carried in ?checkIn=. */
export default function Breathe() {
  const [params] = useSearchParams()
  const checkIn = params.get('checkIn')

  return (
    <div className="flex flex-1 flex-col">
      <p className="label">Breathing</p>
      <h1 className="mt-2 text-[26px] leading-tight font-medium tracking-tight">
        Breathe with me
      </h1>
      <p className="text-ink-soft mt-6 text-sm">Nothing here yet.</p>
      <p className="text-ink-faint mt-2 text-xs">
        {checkIn ? `Linked to check-in ${checkIn.slice(0, 8)}…` : 'Started on its own'}
      </p>
    </div>
  )
}
