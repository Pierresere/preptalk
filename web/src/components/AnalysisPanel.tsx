import { useT } from '../i18n'
import type { Analysis } from '../types.js'

interface AnalysisPanelProps {
  analysis: Analysis | null
  busy: string | null
  onRun: () => void
}

export function AnalysisPanel({ analysis, busy, onRun }: AnalysisPanelProps) {
  const t = useT()

  if (!analysis) {
    return (
      <div className="panel">
        <p>{t('analysis.empty')}</p>
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={onRun}>
          {t('analysis.run')}
        </button>
      </div>
    )
  }

  return (
    <div className="panel">
      <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={onRun}>
        {t('analysis.run')}
      </button>
      <p>{analysis.summary}</p>
      {analysis.requirements.map((req) => (
        <div key={req.index} style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap)' }}>
            <span>#{req.index}</span>
            <span>{req.text}</span>
            <span className={`chip chip-${req.status}`}>{t(`analysis.${req.status}`)}</span>
          </div>
          {req.evidence && (
            <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>{req.evidence}</div>
          )}
        </div>
      ))}
    </div>
  )
}
