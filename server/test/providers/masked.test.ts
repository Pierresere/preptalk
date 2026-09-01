import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { withMasking } from '../../src/providers/masked.js'
import { FakeProvider } from '../../src/providers/fake.js'
import { ProviderError } from '../../src/providers/types.js'
import type { PersonalData } from '../../src/domain/privacy.js'

const personal: PersonalData = {
  names: [{ value: 'Pierre Séré', kind: 'candidate' }],
  keep: ['Câbles Ben-Mor'],
}
const base = { model: 'fake', signal: new AbortController().signal }

describe('withMasking', () => {
  it('masks the outgoing prompt and rehydrates the streamed answer', async () => {
    const fake = new FakeProvider({ stream: 'Bonjour [CANDIDAT_1] chez Câbles Ben-Mor' })
    const out: string[] = []
    for await (const chunk of withMasking(fake).stream({
      ...base, temperature: 0.5, personal,
      system: 'Tu parles à Pierre Séré.',
      messages: [{ role: 'user', text: 'Je suis Pierre Séré.' }],
    })) out.push(chunk)
    const sent = JSON.stringify(fake.calls[0]?.input)
    expect(sent).not.toContain('Pierre Séré')
    expect(sent).toContain('[CANDIDAT_1]')
    expect(out.join('')).toBe('Bonjour Pierre Séré chez Câbles Ben-Mor')
  })

  it('rehydrates a token split across chunks', async () => {
    const fake = new FakeProvider({ stream: '[CANDIDAT_1] arrive' })
    const out: string[] = []
    for await (const chunk of withMasking(fake).stream({
      ...base, temperature: 0.5, personal, system: 'Pierre Séré', messages: [],
    })) out.push(chunk)
    expect(out.join('')).toBe('Pierre Séré arrive')
    expect(out.length).toBeGreaterThan(1)
  })

  it('emits an unclosed bracket run as plain text', async () => {
    const long = `[${'x'.repeat(40)}`
    const fake = new FakeProvider({ stream: long })
    const out: string[] = []
    for await (const chunk of withMasking(fake).stream({
      ...base, temperature: 0.5, personal, system: 'Pierre Séré', messages: [],
    })) out.push(chunk)
    expect(out.join('')).toBe(long)
  })

  it('rehydrates strings nested in a structured result', async () => {
    const schema = z.object({ items: z.array(z.object({ note: z.string() })) })
    const fake = new FakeProvider({ structured: { items: [{ note: 'vu chez [CANDIDAT_1]' }] } })
    const result = await withMasking(fake).structured({
      ...base, personal, schema, system: 'sys', prompt: 'Pierre Séré',
    })
    expect(result.items[0]?.note).toBe('vu chez Pierre Séré')
    expect(JSON.stringify(fake.calls[0]?.input)).not.toContain('Pierre Séré')
  })

  it('passes a clean search query through untouched', async () => {
    const fake = new FakeProvider({ search: { text: 'ok', sources: [] } })
    const result = await withMasking(fake).search({ ...base, query: 'Câbles Ben-Mor secteur' })
    expect(result.text).toBe('ok')
  })

  it('rejects a search query carrying personal data, without echoing it', async () => {
    const fake = new FakeProvider({ search: { text: 'ok', sources: [] } })
    const call = withMasking(fake).search({ ...base, query: 'écrire à pierre.sere@example.com' })
    await expect(call).rejects.toBeInstanceOf(ProviderError)
    await expect(call).rejects.toThrow(/^Personal data in search query$/)
    expect(fake.calls).toHaveLength(0)
  })
})
