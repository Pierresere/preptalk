export type Theme = 'auto' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'preptalk.theme'

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
    return 'auto'
  } catch {
    return 'auto'
  }
}

export function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolve(theme)
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore: persistence is best-effort */
  }
  applyTheme(theme)
}

export function followSystem(current: () => Theme): () => void {
  let mql: MediaQueryList
  try {
    mql = window.matchMedia('(prefers-color-scheme: dark)')
  } catch {
    return () => {}
  }
  const listener = () => {
    if (current() === 'auto') applyTheme('auto')
  }
  mql.addEventListener('change', listener)
  return () => mql.removeEventListener('change', listener)
}
