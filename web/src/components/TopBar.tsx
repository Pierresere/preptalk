import { useT } from '../i18n'
import { ThemeSwitch } from './ThemeSwitch.js'
import { LangSwitch } from './LangSwitch.js'
import type { Screen } from '../screens.js'

interface TopBarProps {
  screen: Screen
  dossierId: string | null
  onNavigate: (name: Screen['name']) => void
}

const NAV_SCREENS: Screen['name'][] = ['dossiers', 'prepare', 'interview', 'debrief']

export function TopBar({ screen, dossierId, onNavigate }: TopBarProps) {
  const t = useT()
  return (
    <div className="topbar">
      <button type="button" className="topbar-brand" onClick={() => onNavigate('home')}>
        {t('app.name')}
      </button>
      {screen.name !== 'home' && (
        <nav className="topbar-nav">
          {NAV_SCREENS.map((name) => (
            <button
              key={name}
              type="button"
              className={screen.name === name ? 'btn btn-primary' : 'btn'}
              disabled={name !== 'dossiers' && dossierId === null}
              onClick={() => onNavigate(name)}
            >
              {t(`nav.${name}`)}
            </button>
          ))}
        </nav>
      )}
      <div className="topbar-actions">
        <ThemeSwitch />
        <LangSwitch />
      </div>
    </div>
  )
}
