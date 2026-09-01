import { describe, expect, it } from 'vitest'
import { parseCompany, renderCompany, researchSection, researchAll } from '../../src/pipeline/research.js'
import { FakeProvider } from '../../src/providers/fake.js'
import type { Dossier } from '../../src/domain/types.js'
import { SECTION_IDS } from '../../src/domain/sections.js'
import type { PersonalData } from '../../src/domain/privacy.js'

const personal: PersonalData = { names: [], keep: ['Acme Corp', 'Engineer'] }

const dossier: Dossier = {
  id: 'acme',
  company: 'Acme Corp',
  position: 'Engineer',
  sites: ['https://acme.example'],
  language: 'fr',
  provider: 'gemini',
  model: 'fake',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('parseCompany / renderCompany round-trip', () => {
  it('round-trips a section map', () => {
    const map = new Map([
      ['sector', 'Textile industry.'],
      ['products', 'Ropes and slings.'],
    ] as const)
    const rendered = renderCompany(map, 'fr')
    const parsed = parseCompany(rendered)
    expect(parsed.get('sector')).toBe('Textile industry.')
    expect(parsed.get('products')).toBe('Ropes and slings.')
  })
})

describe('researchSection', () => {
  it('updates only the researched section and appends sources', async () => {
    const provider = new FakeProvider({ search: { text: 'Ropes.', sources: ['https://a'] } })
    const current = renderCompany(new Map([['sector', 'Textile.']]), 'fr')

    const result = await researchSection(provider, dossier, 'products', current, personal)

    expect(result).toContain('## Produits et services')
    expect(result).toContain('Ropes.')
    expect(result).toContain('- https://a')
    expect(result).toContain('## Secteur')
    expect(result).toContain('Textile.')
  })

  it('stores the not-found sentence when the search text is blank', async () => {
    const provider = new FakeProvider({ search: { text: '   ', sources: [] } })
    const result = await researchSection(provider, dossier, 'sector', '', personal)
    expect(result).toContain('Non trouvé — à vérifier.')
  })
})

describe('researchAll', () => {
  it('runs every section sequentially and calls onSection', async () => {
    const provider = new FakeProvider({ search: { text: 'Some text.', sources: [] } })
    const seen: string[] = []

    const result = await researchAll(provider, dossier, (id) => seen.push(id), personal)

    expect(seen).toEqual([...SECTION_IDS])
    for (const id of SECTION_IDS) {
      expect(result).toContain('Some text.')
    }
  })
})
