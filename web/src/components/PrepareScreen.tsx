import { useState } from 'react'
import { useT } from '../i18n'
import { useDossier } from '../hooks/useDossier.js'
import { TextPanel } from './TextPanel.js'
import { DocumentsPanel } from './DocumentsPanel.js'

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
    runAnalysis,
    generatePlan,
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
            <div className="panel">
              <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void researchAll()}>
                {t('company.researchAll')}
              </button>
              <pre>{bundle.company}</pre>
            </div>
          )}
          {tab === 'analysis' && (
            <div className="panel">
              <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void runAnalysis()}>
                {t('analysis.run')}
              </button>
              <pre>{JSON.stringify(bundle.analysis, null, 2)}</pre>
            </div>
          )}
          {tab === 'plan' && (
            <div className="panel">
              <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void generatePlan()}>
                {t('plan.generate')}
              </button>
              <pre>{JSON.stringify(bundle.plan, null, 2)}</pre>
            </div>
          )}
          {tab === 'documents' && (
            <DocumentsPanel documents={bundle.documents} onAdd={addDocument} onRemove={removeDocument} busy={busy} />
          )}
        </>
      )}
    </div>
  )
}
