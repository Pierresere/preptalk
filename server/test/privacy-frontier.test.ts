import { describe, expect, it } from 'vitest'
import { analyze } from '../src/pipeline/analysis.js'
import { withMasking } from '../src/providers/masked.js'
import { FakeProvider } from '../src/providers/fake.js'
import { personalDataOf } from '../src/domain/privacy.js'
import type { Dossier } from '../src/domain/types.js'

const DOSSIER = {
  id: 'ben-mor', company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité', sites: [],
  language: 'fr', provider: 'gemini', model: 'fake', createdAt: '', updatedAt: '',
} as Dossier

const RESUME = `Pierre Séré
pierre.sere@example.com · 514-555-0123 · H2X 1Y4
https://www.linkedin.com/in/pierre-sere
Coordonnateur qualité depuis 2019 chez Câbles Ben-Mor.
Séré a piloté la certification ISO 9001:2015.`

const OFFER = `Câbles Ben-Mor recrute un coordonnateur qualité.
Contact : Marie Tremblay, marie.tremblay@example.com`

const FORBIDDEN = [
  'Pierre Séré', 'Séré', 'pierre.sere@example.com', '514-555-0123', 'H2X 1Y4',
  'linkedin.com/in/pierre-sere', 'Marie Tremblay', 'marie.tremblay@example.com',
]

describe('provider frontier', () => {
  it('never lets a personal value reach the provider', async () => {
    const fake = new FakeProvider({
      structured: { requirements: [], summary: 'a. b. c.' },
    })
    await analyze({
      provider: withMasking(fake),
      model: 'fake',
      offer: OFFER,
      resume: RESUME,
      language: 'fr',
      personal: personalDataOf(DOSSIER, [
        { value: 'Pierre Séré', kind: 'candidate' },
        { value: 'Séré', kind: 'candidate' },
        { value: 'Marie Tremblay', kind: 'person' },
      ]),
      signal: new AbortController().signal,
    })

    const sent = JSON.stringify(fake.calls)
    for (const value of FORBIDDEN) expect(sent).not.toContain(value)
    expect(sent).toContain('Câbles Ben-Mor')
    expect(sent).toContain('Coordonnateur qualité')
  })
})
