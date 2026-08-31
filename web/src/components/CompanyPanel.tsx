import { useT, useLang } from '../i18n'
import { toHtml } from '../services/markdown.js'
import { SECTIONS } from '../types.js'

interface CompanyPanelProps {
  company: string
  busy: string | null
  onResearchAll: () => void
  onResearchSection: (section: string) => void
}

interface Card {
  title: string | null
  body: string
  sectionId: string | null
}

function matchSectionId(title: string, lang: 'fr' | 'en'): string | null {
  const normalized = title.trim().toLowerCase()
  const match = SECTIONS.find((s) => s.fr.toLowerCase() === normalized || s.en.toLowerCase() === normalized)
  return match ? match.id : null
}

function splitIntoCards(company: string, lang: 'fr' | 'en'): Card[] {
  const lines = company.split('\n')
  const cards: Card[] = []
  let current: Card | null = { title: null, body: '', sectionId: null }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) cards.push(current)
      const title = line.slice(3).trim()
      current = { title, body: '', sectionId: matchSectionId(title, lang) }
    } else if (current) {
      current.body += `${line}\n`
    }
  }
  if (current && (current.title !== null || current.body.trim().length > 0)) cards.push(current)

  return cards
}

export function CompanyPanel({ company, busy, onResearchAll, onResearchSection }: CompanyPanelProps) {
  const t = useT()
  const [lang] = useLang()

  if (company.trim().length === 0) {
    return (
      <div className="panel">
        <p>{t('company.empty')}</p>
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={onResearchAll}>
          {t('company.researchAll')}
        </button>
      </div>
    )
  }

  const cards = splitIntoCards(company, lang)

  return (
    <div className="panel">
      <button type="button" className="btn" disabled={busy !== null} onClick={onResearchAll}>
        {t('company.researchAll')}
      </button>
      {cards.map((card, idx) => (
        <div key={`${card.title ?? 'preamble'}-${idx}`} style={{ marginTop: 'var(--gap)' }}>
          {card.title !== null && <h3>{card.title}</h3>}
          <div dangerouslySetInnerHTML={{ __html: toHtml(card.body) }} />
          {card.sectionId && (
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => onResearchSection(card.sectionId as string)}
            >
              {t('company.rerun')}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
