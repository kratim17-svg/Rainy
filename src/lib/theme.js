/**
 * Dark mode.
 *
 * Toggles a `dark` class on <html>; index.css flips the design tokens.
 * The preference is stored separately from app data — it is a device
 * setting, not something to sync to an account later.
 */

const KEY = 'rainy:v1:theme'

/** @returns {'light' | 'dark' | 'system'} */
export function getThemePreference() {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function setThemePreference(preference) {
  try {
    if (preference === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, preference)
  } catch {
    // storage blocked — the theme still applies for this session
  }
  applyTheme()
}

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

/** @returns {'light' | 'dark'} the mode actually showing */
export function resolvedTheme() {
  const preference = getThemePreference()
  return preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference
}

export function applyTheme() {
  const mode = resolvedTheme()
  document.documentElement.classList.toggle('dark', mode === 'dark')

  // keep the browser/OS chrome in step with the page
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#141412' : '#F8F7F4')

  return mode
}

/** Apply now, and follow the system setting while it is set to 'system'. */
export function initTheme() {
  applyTheme()
  window
    .matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getThemePreference() === 'system') applyTheme()
    })
}
