import { describe, expect, it } from 'vitest'
import { analyze } from '../../src/pipeline/analysis.js'
import { FakeProvider } from '../../src/providers/fake.js'
import { ProviderError } from '../../src/providers/types.js'
import type { Analysis } from '../../src/domain/types.js'

const validAnalysis: Analysis = {
  requirements: [
    {
      index: 0,
      text: 'Manage a team of engineers',
      keywords: ['team management'],
      status: 'covered',
      evidence: 'Led a team of five engineers for two years.',
    },
  ],
  summary: 'Strong overall match. Team management experience is well covered. Some gaps remain in cloud tooling.',
}

const offer = 'We are looking for a senior engineer with strong leadership skills. '.repeat(2)
const resume = 'Experienced engineer who led teams and delivered projects on time. '.repeat(2)

describe('analyze', () => {
  it('rejects when the offer is empty without calling the provider', async () => {
    const provider = new FakeProvider({ structured: validAnalysis })

    await expect(
      analyze({
        provider,
        model: 'fake',
        offer: 'too short',
        resume,
        language: 'en',
        signal: new AbortController().signal,
      })
    ).rejects.toMatchObject(new ProviderError('Offer or resume is empty', 400))
    expect(provider.calls).toHaveLength(0)
  })

  it('rejects when the resume is empty without calling the provider', async () => {
    const provider = new FakeProvider({ structured: validAnalysis })

    await expect(
      analyze({
        provider,
        model: 'fake',
        offer,
        resume: 'too short',
        language: 'en',
        signal: new AbortController().signal,
      })
    ).rejects.toMatchObject(new ProviderError('Offer or resume is empty', 400))
    expect(provider.calls).toHaveLength(0)
  })

  it('returns the provider result and sends both texts in the prompt', async () => {
    const provider = new FakeProvider({ structured: validAnalysis })

    const result = await analyze({
      provider,
      model: 'fake',
      offer,
      resume,
      language: 'en',
      signal: new AbortController().signal,
    })

    expect(result).toEqual(validAnalysis)
    expect(provider.calls).toHaveLength(1)
    const call = provider.calls[0]
    expect(call?.kind).toBe('structured')
    const input = call?.input as { prompt: string; system: string; model: string }
    expect(input.prompt).toContain(offer)
    expect(input.prompt).toContain(resume)
    expect(input.model).toBe('fake')
  })
})
