/**
 * Layout for the focused flows — checking in, writing, breathing.
 *
 * No tab bar: while you are doing one of these, there is nothing else to do.
 * Each screen renders its own FocusHeader, because some of them need an
 * action on the right and some do not.
 */

import { Outlet } from 'react-router'

export default function FocusLayout() {
  return (
    <>
      <div className="bloom-field" aria-hidden="true" />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <Outlet />
      </div>
    </>
  )
}
