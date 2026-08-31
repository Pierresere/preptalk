import type { Dossier, Language } from '../domain/types.js'
import type { Provider } from '../providers/types.js'
import { SECTION_IDS, SECTION_TITLES, buildQuery, notFoundSentence, type SectionId } from '../domain/sections.js'

function titleToSection(title: string): SectionId | null {
  for (const id of SECTION_IDS) {
    if (SECTION_TITLES[id].fr === title || SECTION_TITLES[id].en === title) return id
  }
  return null
}

export function parseCompany(markdown: string): Map<SectionId, string> {
  const sections = new Map<SectionId, string>()
  const headingRe = /^##\s+(.+)$/gm
  const matches = [...markdown.matchAll(headingRe)]
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    if (match === undefined) continue
    const heading = match[1]
    if (heading === undefined) continue
    const id = titleToSection(heading.trim())
    if (id === null) continue
    const start = (match.index ?? 0) + match[0].length
    const next = matches[i + 1]
    const end = next?.index ?? markdown.length
    sections.set(id, markdown.slice(start, end).trim())
  }
  return sections
}

export function renderCompany(sections: ReadonlyMap<SectionId, string>, language: Language): string {
  const blocks: string[] = []
  for (const id of SECTION_IDS) {
    const text = sections.get(id)
    if (text === undefined) continue
    blocks.push(`## ${SECTION_TITLES[id][language]}\n\n${text}`)
  }
  return blocks.join('\n\n')
}

function appendSources(text: string, sources: readonly string[], language: Language): string {
  if (sources.length === 0) return text
  const label = language === 'fr' ? 'Sources :' : 'Sources:'
  const lines = sources.map((url) => `- ${url}`).join('\n')
  return `${text}\n\n${label}\n${lines}`
}

async function searchSection(
  provider: Provider,
  dossier: Dossier,
  section: SectionId,
  knownSector: string | null,
  signal: AbortSignal
): Promise<string> {
  const query = buildQuery(section, dossier, knownSector, dossier.language)
  const result = await provider.search({ query, model: dossier.model, signal })
  const text = result.text.trim()
  if (text === '') return notFoundSentence(dossier.language)
  return appendSources(text, result.sources, dossier.language)
}

export async function researchSection(
  provider: Provider,
  dossier: Dossier,
  section: SectionId,
  currentCompanyMd: string,
  signal: AbortSignal = new AbortController().signal
): Promise<string> {
  const sections = parseCompany(currentCompanyMd)
  const knownSector = section === 'sector' ? null : (sections.get('sector') ?? null)
  const text = await searchSection(provider, dossier, section, knownSector, signal)
  sections.set(section, text)
  return renderCompany(sections, dossier.language)
}

export async function researchAll(
  provider: Provider,
  dossier: Dossier,
  onSection: (id: SectionId) => void,
  signal: AbortSignal = new AbortController().signal
): Promise<string> {
  const sections = new Map<SectionId, string>()
  let knownSector: string | null = null
  for (const id of SECTION_IDS) {
    onSection(id)
    const text = await searchSection(provider, dossier, id, knownSector, signal)
    sections.set(id, text)
    if (id === 'sector') knownSector = text
  }
  return renderCompany(sections, dossier.language)
}
