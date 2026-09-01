import { useState } from 'react'
import { useT } from '../i18n'
import { readTheme, writeTheme, type Theme } from '../services/theme'

const CYCLE: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }

export function ThemeSwitch() {
  const t = useT()
  const [theme, setTheme] = useState<Theme>(readTheme)

  const handleClick = () => {
    const next = CYCLE[theme]
    setTheme(next)
    writeTheme(next)
  }

  const label = theme === 'auto' ? t('theme.auto') : theme === 'light' ? t('theme.light') : t('theme.dark')

  return (
    <button type="button" className="btn" onClick={handleClick}>
      {label}
    </button>
  )
}
