/**
 * Layout for the focused flows — checking in, writing, breathing.
 *
 * No tab bar: while you are doing one of these, there is nothing else to do.
 */

import { Outlet, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'

export default function FocusLayout() {
  const navigate = useNavigate()

  return (
    <>
      <div className="bloom-field" aria-hidden="true" />

      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <header className="app-bar pt-safe sticky top-0 z-10">
          <div className="px-5 pt-4 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="control control-sm"
              aria-label="Go back"
            >
              <ChevronLeft size={19} />
            </button>
          </div>
        </header>

        <main className="pb-safe flex flex-1 flex-col px-5 pb-8">
          <Outlet />
        </main>
      </div>
    </>
  )
}
