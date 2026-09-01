import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { useDossier } from '../hooks/useDossier.js'
import { getPrivacy } from '../services/api.js'
import { TextPanel } from './TextPanel.js'
import { DocumentsPanel } from './DocumentsPanel.js'
import { CompanyPanel } from './CompanyPanel.js'
import { AnalysisPanel } from './AnalysisPanel.js'
import { PlanEditor } from './PlanEditor.js'
import { PrivacyReview } from './PrivacyReview.js'
import type { DossierBundle } from '../types.js'

type SubTab = 'offer' | 'resume' | 'company' | 'analysis' | 'plan' | 'documents'

const STEPS: SubTab[] = ['offer', 'resume', 'company', 'analysis', 'plan']

function stepDone(bundle: DossierBundle, step: SubTab): boolean {
  if (step === 'offer') return bundle.offer.trim() !== ''
  if (step === 'resume') return bundle.resume.trim() !== ''
  if (step === 'company') return bundle.company.trim() !== ''
  if (step === 'analysis') return bundle.analysis !== null
  if (step === 'plan') return bundle.plan !== null
  return true
}

interface PrepareScreenProps {
  id: string
  onInterview: () => void
}

export function PrepareScreen({ id, onInterview }: PrepareScreenProps) {
  const t = useT()
  const [tab, setTab] = useState<SubTab>('offer')
  const [reviewed, setReviewed] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let alive = true
    setReviewed(null)
    setFailed(false)
    getPrivacy(id)
      .then((privacy) => {
        if (alive) setReviewed(privacy.confirmed !== null)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [id, reloadToken])

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

  if (failed) {
    return (
      <div className="panel">
        <p>{t('privacy.loadFailed')}</p>
        <button type="button" className="btn btn-primary" onClick={() => setReloadToken((n) => n + 1)}>
          {t('privacy.retry')}
        </button>
      </div>
    )
  }
  if (reviewed === null || !bundle) return null
  if (!reviewed) return <PrivacyReview id={id} onConfirmed={() => setReviewed(true)} />

  const doneCount = STEPS.filter((step) => stepDone(bundle, step)).length
  const ready = doneCount === STEPS.length

  return (
    <div>
      <div className="prepare-header panel">
        <div>
          <strong>{t('prepare.progress', { done: doneCount, total: STEPS.length })}</strong>
          <p className="form-hint">{ready ? t('prepare.ready') : t('prepare.progressHint')}</p>
        </div>
        <button
          type="button"
          className={ready ? 'btn btn-primary btn-big' : 'btn btn-big'}
          onClick={onInterview}
        >
          {t('prepare.start')}
        </button>
      </div>

      <div className="subtabs">
        {STEPS.map((key) => (
          <button
            key={key}
            type="button"
            className={key === tab ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab(key)}
          >
            <span aria-hidden="true">{stepDone(bundle, key) ? '✓ ' : '○ '}</span>
            {t(`prepare.${key}`)}
          </button>
        ))}
        <button
          type="button"
          className={tab === 'documents' ? 'btn btn-primary' : 'btn'}
          onClick={() => setTab('documents')}
        >
          {t('prepare.documents')}
        </button>
        <button type="button" className="btn" onClick={() => setReviewed(false)}>
          {t('prepare.privacy')}
        </button>
      </div>

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
      {tab === 'analysis' && <AnalysisPanel analysis={bundle.analysis} busy={busy} onRun={() => void runAnalysis()} />}
      {tab === 'plan' && (
        <PlanEditor plan={bundle.plan} busy={busy} onGenerate={() => void generatePlan()} onSave={(plan) => void savePlan(plan)} />
      )}
      {tab === 'documents' && (
        <DocumentsPanel documents={bundle.documents} onAdd={addDocument} onRemove={removeDocument} busy={busy} />
      )}
    </div>
  )
}
