import { mask, unmask } from '../domain/privacy.js'
import type { PersonalData } from '../domain/privacy.js'
import { ProviderError } from './types.js'
import type { Provider, SearchInput, SearchResult, StreamInput, StructuredInput } from './types.js'

const MAX_TOKEN_LENGTH = 32
const NO_NAMES: PersonalData = { names: [], keep: [] }

/**
 * Rehydrates a stream, holding back only a trailing *incomplete* token.
 * A token that already carries its closing bracket is emitted immediately, so the
 * chat keeps streaming instead of stalling until the next 32 characters arrive.
 */
async function* rehydrate(
  source: AsyncIterable<string>,
  map: ReadonlyMap<string, string>
): AsyncIterable<string> {
  let buffer = ''
  for await (const chunk of source) {
    buffer += chunk
    const open = buffer.lastIndexOf('[')
    const closed = open !== -1 && buffer.indexOf(']', open) !== -1
    const runaway = open !== -1 && buffer.length - open > MAX_TOKEN_LENGTH
    const safe = open === -1 || closed || runaway ? buffer.length : open
    if (safe > 0) yield unmask(buffer.slice(0, safe), map)
    buffer = buffer.slice(safe)
  }
  if (buffer !== '') yield unmask(buffer, map)
}

function rehydrateDeep(value: unknown, map: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') return unmask(value, map)
  if (Array.isArray(value)) return value.map((item) => rehydrateDeep(item, map))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rehydrateDeep(item, map)])
    )
  }
  return value
}

function assertClean(query: string, personal: PersonalData): void {
  // A query is built from company/position/sites only; anything else is a bug, not a user error.
  if (mask(query, personal).map.size > 0) {
    throw new ProviderError('Personal data in search query', 500)
  }
}

export function withMasking(provider: Provider): Provider {
  return {
    id: provider.id,
    models: provider.models,

    stream(input: StreamInput): AsyncIterable<string> {
      const system = mask(input.system, input.personal)
      const map = new Map(system.map)
      const messages = input.messages.map((message) => {
        const masked = mask(message.text, input.personal)
        for (const [token, value] of masked.map) map.set(token, value)
        return { role: message.role, text: masked.text }
      })
      // `personal` is replaced, not forwarded: the confirmed names are themselves personal data
      // and have no business sitting in the object handed to the real provider.
      return rehydrate(
        provider.stream({ ...input, system: system.text, messages, personal: NO_NAMES }),
        map
      )
    },

    async structured<T>(input: StructuredInput<T>): Promise<T> {
      const system = mask(input.system, input.personal)
      const prompt = mask(input.prompt, input.personal)
      const map = new Map([...system.map, ...prompt.map])
      const result = await provider.structured({
        ...input,
        system: system.text,
        prompt: prompt.text,
        personal: NO_NAMES,
      })
      return rehydrateDeep(result, map) as T
    },

    async search(input: SearchInput): Promise<SearchResult> {
      assertClean(input.query, NO_NAMES)
      return provider.search(input)
    },
  }
}
