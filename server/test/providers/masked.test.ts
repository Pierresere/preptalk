import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { withMasking } from '../../src/providers/masked.js'
import { FakeProvider } from '../../src/providers/fake.js'
import { ProviderError } from '../../src/providers/types.js'
import type { Provider, SearchInput, SearchResult, StreamInput, StructuredInput } from '../../src/providers/types.js'
import type { PersonalData } from '../../src/domain/privacy.js'

const personal: PersonalData = {
  names: [{ value: 'Pierre Séré', kind: 'candidate' }],
  keep: ['Câbles Ben-Mor'],
}
const base = { model: 'fake', signal: new AbortController().signal }

/** A stub provider whose `stream` yields exactly the chunks given, so tests can control chunk boundaries. */
function chunkedProvider(chunks: readonly string[]): Provider {
  return {
    id: 'gemini',
    models: ['fake'],
    async *stream(_input: StreamInput): AsyncIterable<string> {
      for (const chunk of chunks) yield chunk
    },
    async structured<T>(input: StructuredInput<T>): Promise<T> {
      return input.schema.parse(undefined)
    },
    async search(_input: SearchInput): Promise<SearchResult> {
      return { text: '', sources: [] }
    },
  }
}

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

  it('rehydrates a token split across explicit chunk boundaries', async () => {
    const provider = chunkedProvider(['[CAND', 'IDAT', '_1] arrive'])
    const out: string[] = []
    for await (const chunk of withMasking(provider).stream({
      ...base, temperature: 0.5, personal, system: 'Pierre Séré', messages: [],
    })) out.push(chunk)
    expect(out.join('')).toBe('Pierre Séré arrive')
  })

  it('emits an unclosed bracket run of more than 32 characters verbatim', async () => {
    const provider = chunkedProvider(['before [', 'x'.repeat(20), 'x'.repeat(20), ' after'])
    const out: string[] = []
    for await (const chunk of withMasking(provider).stream({
      ...base, temperature: 0.5, personal, system: 'Pierre Séré', messages: [],
    })) out.push(chunk)
    expect(out.join('')).toBe(`before [${'x'.repeat(40)} after`)
  })

  it('flushes a stream whose last chunk ends mid-token', async () => {
    const provider = chunkedProvider(['answer [CAND', 'IDAT_1]'])
    const out: string[] = []
    for await (const chunk of withMasking(provider).stream({
      ...base, temperature: 0.5, personal, system: 'Pierre Séré', messages: [],
    })) out.push(chunk)
    expect(out.join('')).toBe('answer Pierre Séré')
  })

  it('does not collide two distinct values across system and messages', async () => {
    const twoNames: PersonalData = {
      names: [
        { value: 'Marie Tremblay', kind: 'person' },
        { value: 'Jean Roy', kind: 'person' },
      ],
      keep: [],
    }
    const provider = chunkedProvider(['[PERSONNE_1] a parlé à [PERSONNE_2].'])
    const out: string[] = []
    for await (const chunk of withMasking(provider).stream({
      ...base, temperature: 0.5, personal: twoNames,
      system: 'Contexte : Marie Tremblay dirige.',
      messages: [{ role: 'user', text: 'Jean Roy pose une question.' }],
    })) out.push(chunk)
    expect(out.join('')).toBe('Marie Tremblay a parlé à Jean Roy.')
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
    const result = await withMasking(fake).search({ ...base, personal, query: 'Câbles Ben-Mor secteur' })
    expect(result.text).toBe('ok')
  })

  it('rejects a search query carrying a confirmed name', async () => {
    const fake = new FakeProvider({ search: { text: 'ok', sources: [] } })
    const call = withMasking(fake).search({ ...base, personal, query: 'Pierre Séré Câbles Ben-Mor' })
    await expect(call).rejects.toThrow(/^Personal data in search query$/)
    expect(fake.calls).toHaveLength(0)
  })

  it('rejects a search query carrying personal data, without echoing it', async () => {
    const fake = new FakeProvider({ search: { text: 'ok', sources: [] } })
    const call = withMasking(fake).search({ ...base, personal, query: 'écrire à pierre.sere@example.com' })
    await expect(call).rejects.toBeInstanceOf(ProviderError)
    await expect(call).rejects.toThrow(/^Personal data in search query$/)
    expect(fake.calls).toHaveLength(0)
  })
})
