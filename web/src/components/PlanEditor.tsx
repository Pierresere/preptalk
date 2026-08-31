import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { PhaseEditor } from './PhaseEditor.js'
import type { Plan } from '../types.js'

interface PlanEditorProps {
  plan: Plan | null
  busy: string | null
  onGenerate: () => void
  onSave: (plan: Plan) => void
}

function totalQuestions(plan: Plan): number {
  return plan.phases.reduce((sum, phase) => sum + phase.questions, 0)
}

export function PlanEditor({ plan, busy, onGenerate, onSave }: PlanEditorProps) {
  const t = useT()
  const [draft, setDraft] = useState<Plan | null>(plan)

  useEffect(() => {
    setDraft(plan)
  }, [plan])

  if (!plan) {
    return (
      <div className="panel">
        <p>{t('plan.empty')}</p>
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={onGenerate}>
          {t('plan.generate')}
        </button>
      </div>
    )
  }

  if (!draft) return null

  const dirty = JSON.stringify(draft) !== JSON.stringify(plan)

  return (
    <div className="panel">
      <div style={{ display: 'flex', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={onGenerate}>
          {t('plan.generate')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null || !dirty}
          onClick={() => onSave(draft)}
        >
          {t('plan.save')}
        </button>
      </div>

      <div className="panel" style={{ marginBottom: 'var(--gap)' }}>
        <h3>{t('plan.persona')}</h3>
        <label>
          {t('plan.personaName')}
          <input
            type="text"
            value={draft.persona.name}
            onChange={(e) => setDraft({ ...draft, persona: { ...draft.persona, name: e.target.value } })}
          />
        </label>
        <label>
          {t('plan.personaRole')}
          <input
            type="text"
            value={draft.persona.role}
            onChange={(e) => setDraft({ ...draft, persona: { ...draft.persona, role: e.target.value } })}
          />
        </label>
        <label>
          {t('plan.personaConcerns')}
          <textarea
            value={draft.persona.concerns}
            onChange={(e) => setDraft({ ...draft, persona: { ...draft.persona, concerns: e.target.value } })}
          />
        </label>
        <label>
          {t('plan.personaTone')}
          <input
            type="text"
            value={draft.persona.tone}
            onChange={(e) => setDraft({ ...draft, persona: { ...draft.persona, tone: e.target.value } })}
          />
        </label>
      </div>

      <h3>{t('plan.phases')}</h3>
      {draft.phases.map((phase, index) => (
        <PhaseEditor
          key={phase.id}
          phase={phase}
          onChange={(updated) =>
            setDraft({
              ...draft,
              phases: draft.phases.map((p, i) => (i === index ? updated : p)),
            })
          }
        />
      ))}

      <p>{t('plan.total', { n: totalQuestions(draft) })}</p>
    </div>
  )
}
