import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ChevronRight } from 'lucide-react'
import Screen from './Screen.jsx'
import Toast from '../components/Toast.jsx'
import { greetingFor, formatLongDate } from '../lib/time.js'

export default function Home() {
  const now = new Date()
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState(location.state?.toast ?? null)

  // clear the flag so the chip does not reappear on a refresh or a back
  const dismiss = useCallback(() => {
    setToast(null)
    navigate('.', { replace: true, state: null })
  }, [navigate])

  return (
    <Screen label={formatLongDate(now)} title={greetingFor(now)}>
      <Link
        to="/check-in"
        className="sheet mt-8 flex items-center justify-between gap-4 p-6"
      >
        <span className="text-[17px] leading-snug font-medium tracking-tight">
          How are you feeling right now?
        </span>
        <ChevronRight size={20} className="text-ink-faint shrink-0" aria-hidden="true" />
      </Link>

      {toast && <Toast message={toast} onDone={dismiss} />}
    </Screen>
  )
}
