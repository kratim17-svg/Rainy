/**
 * The frame every screen sits in: a header that stays put, the active
 * screen, and the bottom tabs.
 */

import { NavLink, Outlet } from 'react-router'
import { House, NotebookPen, ChartColumn, Settings } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Home', Icon: House },
  { to: '/journal', label: 'Journal', Icon: NotebookPen },
  { to: '/insights', label: 'Insights', Icon: ChartColumn },
]

export default function AppShell() {
  return (
    <>
      <div className="bloom-field" aria-hidden="true" />

      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <header className="app-bar pt-safe sticky top-0 z-10">
          <div className="flex items-center justify-between px-5 pt-4 pb-6">
            <span className="text-[17px] font-medium tracking-tight">Rainy</span>
            <button type="button" className="control control-sm" aria-label="Settings">
              <Settings size={17} />
            </button>
          </div>
        </header>

        {/* pb leaves room for the floating tab bar */}
        <main className="flex-1 px-5 pb-32">
          <Outlet />
        </main>

        <nav
          className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-4"
          aria-label="Sections"
        >
          <div className="sheet mb-4 flex items-stretch gap-1 p-1.5">
            {TABS.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className="tab">
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </>
  )
}
