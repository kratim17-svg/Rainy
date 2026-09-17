/**
 * The first-run ask for notification permission.
 *
 * A card rather than a modal: the first thing Rainy does should not be to
 * block the screen. It appears once, and goes for good either way.
 */

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { hasBeenAsked, markAsked, permission, requestPermission, supported } from '../lib/notifications.js'

export default function PermissionCard({ onSettled }) {
  const [gone, setGone] = useState(
    () => !supported() || hasBeenAsked() || permission() !== 'default',
  )
  const [busy, setBusy] = useState(false)

  if (gone) return null

  const allow = async () => {
    setBusy(true)
    const result = await requestPermission()
    setGone(true)
    onSettled?.(result)
  }

  const notNow = () => {
    markAsked()
    setGone(true)
    onSettled?.('dismissed')
  }

  return (
    <section className="sheet mt-6 p-5">
      <span className="bg-low-wash text-low grid size-10 place-items-center rounded-pill">
        <Bell size={18} aria-hidden="true" />
      </span>

      <p className="mt-4 text-[15px] leading-relaxed">
        Rainy works best with reminders. May I send you 4 check-in nudges a day? You can
        customise the times in settings.
      </p>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={allow}
          disabled={busy}
          className="btn btn-primary min-h-11 flex-1 whitespace-nowrap"
        >
          {busy ? 'Just a moment…' : 'Yes, remind me'}
        </button>
        <button
          type="button"
          onClick={notNow}
          className="btn btn-quiet min-h-11 w-auto shrink-0 px-4 whitespace-nowrap"
        >
          Not now
        </button>
      </div>
    </section>
  )
}
