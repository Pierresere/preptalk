import { describe, it, expect, vi } from 'vitest'
import { readSse } from '../src/services/sse.js'
import type { Session } from '../src/types.js'

describe('readSse', () => {
  it('dispatches stage, chunk, and done handlers in order', async () => {
    const minimalSession: Session = {
      id: 's1',
      dossierId: 'd1',
      provider: 'openai',
      model: 'gpt',
      startedAt: '2026-01-01T00:00:00.000Z',
      messages: [],
      debrief: null,
    }
    const body =
      'event: stage\ndata: {"stage":"thinking"}\n\n' +
      'event: chunk\ndata: {"delta":"Hi"}\n\n' +
      `event: done\ndata: {"session":${JSON.stringify(minimalSession)}}\n\n`

    const response = new Response(body)
    const calls: string[] = []
    const onStage = vi.fn((s: string) => calls.push(`stage:${s}`))
    const onChunk = vi.fn((d: string) => calls.push(`chunk:${d}`))
    const onDone = vi.fn((session: Session) => calls.push(`done:${session.id}`))

    await readSse(response, { stage: onStage, chunk: onChunk, done: onDone })

    expect(calls).toEqual(['stage:thinking', 'chunk:Hi', 'done:s1'])
  })

  it('ignores unknown events and tolerates missing leading space on data', async () => {
    const body = 'event: mystery\ndata:{"x":1}\n\n' + 'event: sources\ndata: {"ids":["a","b"]}\n\n'
    const response = new Response(body)
    const onSources = vi.fn()
    await readSse(response, { sources: onSources })
    expect(onSources).toHaveBeenCalledWith(['a', 'b'])
  })

  it('dispatches error handler', async () => {
    const body = 'event: error\ndata: {"message":"boom"}\n\n'
    const response = new Response(body)
    const onError = vi.fn()
    await readSse(response, { error: onError })
    expect(onError).toHaveBeenCalledWith('boom')
  })
})
