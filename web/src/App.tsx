import { I18nProvider, useT } from './i18n'
import { ThemeSwitch } from './components/ThemeSwitch'
import { LangSwitch } from './components/LangSwitch'

function TopBar() {
  const t = useT()
  return (
    <div className="topbar">
      <strong>{t('app.name')}</strong>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--gap)' }}>
        <ThemeSwitch />
        <LangSwitch />
      </div>
    </div>
  )
}

export function App() {
  return (
    <I18nProvider>
      <TopBar />
      <div className="screen" />
    </I18nProvider>
  )
}
