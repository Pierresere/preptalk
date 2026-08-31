import { useState } from 'react'
import { useT } from '../i18n'
import { useDossier } from '../hooks/useDossier.js'
import { TextPanel } from './TextPanel.js'
import { DocumentsPanel } from './DocumentsPanel.js'
import { CompanyPanel } from './CompanyPanel.js'
import { AnalysisPanel } from './AnalysisPanel.js'
import { PlanEditor } from './PlanEditor.js'

type SubTab = 'offer' | 'resume' | 'company' | 'analysis' | 'plan' | 'documents'

const TABS: SubTab[] = ['offer', 'resume', 'company', 'analysis', 'plan', 'documents']

interface PrepareScreenProps {
  id: string
  onInterview: () => void
}

export function PrepareScreen({ id, onInterview }: PrepareScreenProps) {
  const t = useT()
  const [tab, setTab] = useState<SubTab>('offer')
  const {
    bundle,
    busy,
    saveText,
    addDocument,
    removeDocument,
    researchAll,
    researchSection,
    runAnalysis,
    generatePlan,
    savePlan,
  } = useDossier(id)

  return (
    <div>
      <div className="subtabs" style={{ display: 'flex', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            className={key === tab ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab(key)}
          >
            {t(`prepare.${key}`)}
          </button>
        ))}
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={onInterview}>
          {t('nav.interview')}
        </button>
      </div>

      {!bundle ? null : (
        <>
          {tab === 'offer' && (
            <TextPanel label={t('prepare.offer')} value={bundle.offer} onSave={(text) => saveText('offer', text)} busy={busy} />
          )}
          {tab === 'resume' && (
            <TextPanel label={t('prepare.resume')} value={bundle.resume} onSave={(text) => saveText('resume', text)} busy={busy} />
          )}
          {tab === 'company' && (
            <CompanyPanel
              company={bundle.company}
              busy={busy}
              onResearchAll={() => void researchAll()}
              onResearchSection={(section) => void researchSection(section)}
            />
          )}
          {tab === 'analysis' && (
            <AnalysisPanel analysis={bundle.analysis} busy={busy} onRun={() => void runAnalysis()} />
          )}
          {tab === 'plan' && (
            <PlanEditor
              plan={bundle.plan}
              busy={busy}
              onGenerate={() => void generatePlan()}
              onSave={(plan) => void savePlan(plan)}
            />
          )}
          {tab === 'documents' && (
            <DocumentsPanel documents={bundle.documents} onAdd={addDocument} onRemove={removeDocument} busy={busy} />
          )}
        </>
      )}
    </div>
  )
}
