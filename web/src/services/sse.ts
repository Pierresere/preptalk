import type { Session } from '../types.js'

export interface SseHandlers {
  stage?(stage: string): void
  sources?(ids: string[]): void
  chunk?(delta: string): void
  done?(session: Session): void
  error?(message: string): void
}

interface ParsedEvent {
  event: string
  data: string
}

function parseEvent(block: string): ParsedEvent | null {
  let event = ''
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      const rest = line.slice('data:'.length)
      data = rest.startsWith(' ') ? rest.slice(1) : rest
    }
  }
  return event === '' ? null : { event, data }
}

function dispatch(on: SseHandlers, parsed: ParsedEvent): void {
  switch (parsed.event) {
    case 'stage': {
      const payload = JSON.parse(parsed.data) as { stage: string }
      on.stage?.(payload.stage)
      break
    }
    case 'sources': {
      const payload = JSON.parse(parsed.data) as { ids: string[] }
      on.sources?.(payload.ids)
      break
    }
    case 'chunk': {
      const payload = JSON.parse(parsed.data) as { delta: string }
      on.chunk?.(payload.delta)
      break
    }
    case 'done': {
      const payload = JSON.parse(parsed.data) as { session: Session }
      on.done?.(payload.session)
      break
    }
    case 'error': {
      const payload = JSON.parse(parsed.data) as { message: string }
      on.error?.(payload.message)
      break
    }
    default:
      break
  }
}

export async function readSse(response: Response, on: SseHandlers): Promise<void> {
  const body = response.body
  if (body === null) return
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      const parsed = parseEvent(block)
      if (parsed !== null) dispatch(on, parsed)
    }
  }

  const parsed = parseEvent(buffer)
  if (parsed !== null) dispatch(on, parsed)
}
