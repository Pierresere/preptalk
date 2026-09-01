import { useT } from '../i18n'
import type { Phase } from '../types.js'

interface PhaseEditorProps {
  phase: Phase
  onChange: (phase: Phase) => void
}

function parseQuestions(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
}

function parseTargeting(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parseExamples(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function PhaseEditor({ phase, onChange }: PhaseEditorProps) {
  const t = useT()

  return (
    <div className="panel" style={{ marginBottom: 'var(--gap)' }}>
      <label>
        {t('plan.phases')}
        <input
          type="text"
          value={phase.title}
          onChange={(e) => onChange({ ...phase, title: e.target.value })}
        />
      </label>
      <label>
        {t('plan.questions')}
        <input
          type="number"
          min={1}
          value={phase.questions}
          onChange={(e) => onChange({ ...phase, questions: parseQuestions(e.target.value) })}
        />
      </label>
      <label>
        {t('plan.objective')}
        <textarea
          value={phase.objective}
          onChange={(e) => onChange({ ...phase, objective: e.target.value })}
        />
      </label>
      <label>
        {t('plan.targeting')}
        <input
          type="text"
          value={phase.targeting.join(', ')}
          onChange={(e) => onChange({ ...phase, targeting: parseTargeting(e.target.value) })}
        />
      </label>
      <label>
        {t('plan.examples')}
        <textarea
          value={phase.examples.join('\n')}
          onChange={(e) => onChange({ ...phase, examples: parseExamples(e.target.value) })}
        />
      </label>
    </div>
  )
}
