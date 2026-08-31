import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FakeProvider } from '../../src/providers/fake.js'

describe('FakeProvider', () => {
  it('streams the scripted text in words', async () => {
    const p = new FakeProvider({ stream: 'hello big world' })
    const parts: string[] = []
    for await (const d of p.stream({ system: '', messages: [], model: 'fake', temperature: 0, signal: new AbortController().signal })) parts.push(d)
    expect(parts.join('')).toBe('hello big world')
    expect(p.calls[0]?.kind).toBe('stream')
  })
  it('validates structured output against the schema', async () => {
    const p = new FakeProvider({ structured: { a: 1 } })
    const out = await p.structured({ system: '', prompt: '', schema: z.object({ a: z.number() }), model: 'fake', signal: new AbortController().signal })
    expect(out).toEqual({ a: 1 })
  })
})
