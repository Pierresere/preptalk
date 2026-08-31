import { useState } from 'react'
import { I18nProvider } from './i18n'
import { TopBar } from './components/TopBar.js'
import { DossierList } from './components/DossierList'
import { DossierForm } from './components/DossierForm'
import { useDossiers } from './hooks/useDossiers'
import { PrepareScreen } from './components/PrepareScreen'
import { InterviewScreen } from './components/InterviewScreen'
import { DebriefScreen } from './components/DebriefScreen.js'
import type { CreateDossierInput } from './services/api.js'
import type { Screen } from './screens.js'

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

function Content({ screen, onInterview }: { screen: Screen; onInterview: () => void }) {
  if (screen.name === 'dossiers') {
    return null
  }
  if (screen.name === 'prepare') {
    return <PrepareScreen id={screen.id} onInterview={onInterview} />
  }
  if (screen.name === 'interview') {
    return <InterviewScreen id={screen.id} />
  }
  return <DebriefScreen id={screen.id} />
}

export function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  )
}

function AppShell() {
  const [screen, setScreen] = useState<Screen>({ name: 'dossiers' })
  const dossierId = screen.name === 'dossiers' ? null : screen.id

  const navigate = (name: Screen['name']) => {
    if (name === 'dossiers') {
      setScreen({ name: 'dossiers' })
      return
    }
    if (dossierId !== null) {
      setScreen({ name, id: dossierId })
    }
  }

  return (
    <>
      <TopBar screen={screen} dossierId={dossierId} onNavigate={navigate} />
      <div className="screen">
        {screen.name === 'dossiers' ? (
          <DossiersScreen onOpen={(id) => setScreen({ name: 'prepare', id })} />
        ) : (
          <Content screen={screen} onInterview={() => navigate('interview')} />
        )}
      </div>
    </>
  )
}
