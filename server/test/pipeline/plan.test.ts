import { describe, expect, it } from 'vitest'
import { generatePlan, needsLanguageSwitch } from '../../src/pipeline/plan.js'
import { FakeProvider } from '../../src/providers/fake.js'
import { ProviderError } from '../../src/providers/types.js'
import type { Dossier, Persona } from '../../src/domain/types.js'

const persona: Persona = {
  name: 'Jane Doe',
  role: 'Engineering Manager',
  concerns: 'Delivering on time with a small team.',
  tone: 'Direct and pragmatic.',
}

const draftPhase = (id: string) => ({
  id,
  title: `Title ${id}`,
  objective: `Objective ${id}`,
  targeting: ['keyword1', 'keyword2'],
  examples: ['Example question 1', 'Example question 2'],
})

const fullDraft = {
  persona,
  phases: [
    'welcome',
    'core',
    'domain',
    'situations',
    'behavior',
    'sensitive',
    'questions',
  ].map(draftPhase),
}

const draftWithLanguageSwitch = {
  persona,
  phases: [...fullDraft.phases, draftPhase('language-switch')],
}

const dossier: Dossier = {
  id: 'acme',
  company: 'Acme',
  position: 'Engineer',
  sites: [],
  language: 'en',
  provider: 'gemini',
  model: 'fake',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const offer = 'We need a senior engineer.'
const resume = 'Experienced engineer.'
const company = 'Acme makes widgets.'

describe('needsLanguageSwitch', () => {
  it('is true when the offer mentions bilingual', () => {
    expect(needsLanguageSwitch('Bilingual required')).toBe(true)
  })

  it('is false when the offer does not mention a language requirement', () => {
    expect(needsLanguageSwitch('Senior engineer wanted')).toBe(false)
  })
})

describe('generatePlan', () => {
  it('builds 16 questions in skeleton order when no language switch is needed', async () => {
    const provider = new FakeProvider({ structured: fullDraft })

    const plan = await generatePlan({
      provider,
      model: 'fake',
      dossier,
      offer,
      resume,
      company,
      analysis: null,
      signal: new AbortController().signal,
    })

    expect(plan.phases.map((p) => p.id)).toEqual([
      'welcome',
      'core',
      'domain',
      'situations',
      'behavior',
      'sensitive',
      'questions',
    ])
    const totalQuestions = plan.phases.reduce((sum, p) => sum + p.questions, 0)
    expect(totalQuestions).toBe(16)
  })

  it('inserts language-switch right before questions when the offer mentions bilingue', async () => {
    const provider = new FakeProvider({ structured: draftWithLanguageSwitch })

    const plan = await generatePlan({
      provider,
      model: 'fake',
      dossier,
      offer: 'Poste bilingue requis',
      resume,
      company,
      analysis: null,
      signal: new AbortController().signal,
    })

    expect(plan.phases).toHaveLength(8)
    const ids = plan.phases.map((p) => p.id)
    expect(ids.indexOf('language-switch')).toBe(ids.indexOf('questions') - 1)
  })

  it('rejects when the draft is missing a phase id', async () => {
    const incompleteDraft = { persona, phases: fullDraft.phases.slice(0, 6) }
    const provider = new FakeProvider({ structured: incompleteDraft })

    await expect(
      generatePlan({
        provider,
        model: 'fake',
        dossier,
        offer,
        resume,
        company,
        analysis: null,
        signal: new AbortController().signal,
      })
    ).rejects.toMatchObject(new ProviderError('Plan draft missing phase questions', 502))
  })
})
