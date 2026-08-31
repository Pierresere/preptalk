import { useT } from '../i18n'

interface SourcesPanelProps {
  ids: readonly string[]
}

function humanise(id: string): string {
  const [head, ...rest] = id.split('/')
  if (head === undefined) return id
  const label = head.charAt(0).toUpperCase() + head.slice(1)
  return rest.length > 0 ? `${label} · ${rest.join('/')}` : label
}

export function SourcesPanel({ ids }: SourcesPanelProps) {
  const t = useT()

  return (
    <div className="panel">
      <strong>{t('interview.sources')}</strong>
      {ids.length === 0 ? (
        <p>{t('interview.noSources')}</p>
      ) : (
        <ul>
          {ids.map((id) => (
            <li key={id}>{humanise(id)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
