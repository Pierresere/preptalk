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
      <strong>{t('app.name')}</strong>
      <nav style={{ display: 'flex', gap: 'var(--gap)', marginLeft: 'var(--gap)' }}>
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
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--gap)' }}>
        <ThemeSwitch />
        <LangSwitch />
      </div>
    </div>
  )
}
