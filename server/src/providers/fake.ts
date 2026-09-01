import type { Provider, SearchInput, SearchResult, StreamInput, StructuredInput } from './types.js'

interface Script {
  readonly stream?: string
  readonly structured?: unknown
  readonly search?: SearchResult
}

interface Call {
  readonly kind: 'stream' | 'structured' | 'search'
  readonly input: unknown
}

export class FakeProvider implements Provider {
  readonly id = 'gemini' as const
  readonly models: readonly string[] = ['fake']
  readonly calls: Call[] = []
  constructor(private readonly script: Script) {}

  async *stream(input: StreamInput): AsyncIterable<string> {
    this.calls.push({ kind: 'stream', input })
    const words = (this.script.stream ?? 'fake answer').split(' ')
    for (const [i, w] of words.entries()) yield i === 0 ? w : ` ${w}`
  }

  async structured<T>(input: StructuredInput<T>): Promise<T> {
    this.calls.push({ kind: 'structured', input })
    return input.schema.parse(this.script.structured)
  }

  async search(input: SearchInput): Promise<SearchResult> {
    this.calls.push({ kind: 'search', input })
    return this.script.search ?? { text: 'Not found — to verify', sources: [] }
  }
}
