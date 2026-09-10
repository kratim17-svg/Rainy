/**
 * Routes.
 *
 * Real URLs rather than tab state, so Android's back button moves between
 * tabs instead of closing the app, and notifications can deep-link later.
 *
 * Two layouts: AppShell carries the tab bar, FocusLayout drops it for the
 * flows where there is only one thing to be doing.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import AppShell from './layout/AppShell.jsx'
import FocusLayout from './layout/FocusLayout.jsx'
import Home from './screens/Home.jsx'
import Journal from './screens/Journal.jsx'
import Insights from './screens/Insights.jsx'
import CheckIn from './screens/CheckIn.jsx'
import CheckInSupport from './screens/CheckInSupport.jsx'
import BrainDump from './screens/BrainDump.jsx'
import Breathe from './screens/Breathe.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="journal" element={<Journal />} />
          <Route path="insights" element={<Insights />} />
        </Route>

        <Route element={<FocusLayout />}>
          <Route path="check-in" element={<CheckIn />} />
          <Route path="check-in/support" element={<CheckInSupport />} />
          <Route path="brain-dump" element={<BrainDump />} />
          <Route path="breathe" element={<Breathe />} />
        </Route>

        {/* an unknown URL — from an old notification, say — lands home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
