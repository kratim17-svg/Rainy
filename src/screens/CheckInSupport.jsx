import { Link, useNavigate, useSearchParams } from 'react-router'
import { PenLine, Wind } from 'lucide-react'
import FocusHeader from '../components/FocusHeader.jsx'

/**
 * Shown after a check-in of 6 or more. The score is already saved — these
 * are offers, not steps in a flow, and "Just save" simply closes them.
 */
export default function CheckInSupport() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const checkIn = params.get('checkIn')
  const query = checkIn ? `?checkIn=${checkIn}` : ''

  const options = [
    {
      to: `/brain-dump${query}`,
      Icon: PenLine,
      title: 'Write it out',
      blurb: 'Empty it onto the page, unedited.',
    },
    {
      to: `/breathe${query}`,
      Icon: Wind,
      title: 'Breathe with me',
      blurb: 'A few minutes of slower breathing.',
    },
  ]

  return (
    <>
      <FocusHeader onBack={() => navigate('/', { replace: true })} />

      <main className="pb-safe flex flex-1 flex-col px-5 pb-8">
      <p className="label">Logged</p>
      <h1 className="mt-2 text-[26px] leading-tight font-medium tracking-tight">
        That sounds like a lot.
      </h1>
      <p className="text-ink-soft mt-3 text-[15px] leading-relaxed">
        Would either of these help right now?
      </p>

      <div className="mt-8 space-y-3">
        {options.map(({ to, Icon, title, blurb }) => (
          <Link key={to} to={to} className="sheet flex items-center gap-4 p-5">
            <span className="bg-sunken text-ink-soft grid size-11 shrink-0 place-items-center rounded-pill">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-medium tracking-tight">{title}</span>
              <span className="text-ink-faint block text-[13px]">{blurb}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => navigate('/', { replace: true, state: { toast: 'Logged' } })}
        className="btn btn-quiet"
      >
        Just save
      </button>
      </main>
    </>
  )
}
