import { useState } from 'react'
import { I18nProvider, useT } from './i18n'
import { ThemeSwitch } from './components/ThemeSwitch'
import { LangSwitch } from './components/LangSwitch'
import { DossierList } from './components/DossierList'
import { DossierForm } from './components/DossierForm'
import { useDossiers } from './hooks/useDossiers'
import { PrepareScreen } from './components/PrepareScreen'
import { InterviewScreen } from './components/InterviewScreen'
import type { CreateDossierInput } from './services/api.js'
import type { Screen } from './screens.js'

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

function DossiersScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const { dossiers, providers, create, remove } = useDossiers()
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (input: CreateDossierInput) => {
    const created = await create(input)
    setCreating(false)
    onOpen(created.id)
  }

  return (
    <div>
      {creating ? (
        <DossierForm providers={providers} onSubmit={handleSubmit} onCancel={() => setCreating(false)} />
      ) : (
        <DossierList dossiers={dossiers} onOpen={onOpen} onDelete={remove} onNew={() => setCreating(true)} />
      )}
    </div>
  )
}

function Content() {
  const [screen, setScreen] = useState<Screen>({ name: 'dossiers' })

  if (screen.name === 'dossiers') {
    return <DossiersScreen onOpen={(id) => setScreen({ name: 'prepare', id })} />
  }
  if (screen.name === 'prepare') {
    return <PrepareScreen id={screen.id} onInterview={() => setScreen({ name: 'interview', id: screen.id })} />
  }
  if (screen.name === 'interview') {
    return <InterviewScreen id={screen.id} />
  }
  return null
}

export function App() {
  return (
    <I18nProvider>
      <TopBar />
      <div className="screen">
        <Content />
      </div>
    </I18nProvider>
  )
}
