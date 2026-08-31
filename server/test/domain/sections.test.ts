import { describe, expect, it } from 'vitest'
import { buildQuery, notFoundSentence } from '../../src/domain/sections.js'
import type { Dossier } from '../../src/domain/types.js'

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

describe('notFoundSentence', () => {
  it('returns the French sentence', () => {
    expect(notFoundSentence('fr')).toBe('Non trouvé — à vérifier.')
  })
  it('returns the English sentence', () => {
    expect(notFoundSentence('en')).toBe('Not found — to verify.')
  })
})

describe('buildQuery', () => {
  it('contains the company name and the French not-found sentence', () => {
    const query = buildQuery('revenue', dossier, 'lifting', 'fr')
    expect(query).toContain('Acme Corp')
    expect(query).toContain('Non trouvé — à vérifier.')
  })

  it('contains the known sector when provided', () => {
    const query = buildQuery('revenue', dossier, 'lifting', 'fr')
    expect(query).toContain('lifting')
  })

  it('contains the sites', () => {
    const query = buildQuery('sector', dossier, null, 'en')
    expect(query).toContain('https://acme.example')
  })
})
