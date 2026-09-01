import type { z } from 'zod'
import type { ProviderId } from '../domain/types.js'
import type { PersonalData } from '../domain/privacy.js'

export interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly text: string
}

export interface StreamInput {
  readonly system: string
  readonly messages: readonly ChatMessage[]
  readonly personal: PersonalData
  readonly model: string
  readonly temperature: number
  readonly signal: AbortSignal
}

export interface StructuredInput<T> {
  readonly system: string
  readonly prompt: string
  readonly personal: PersonalData
  readonly schema: z.ZodType<T>
  readonly model: string
  readonly signal: AbortSignal
}

export interface SearchInput {
  readonly query: string
  readonly personal: PersonalData
  readonly model: string
  readonly signal: AbortSignal
}

export interface SearchResult {
  readonly text: string
  readonly sources: readonly string[]
}

export interface Provider {
  readonly id: ProviderId
  readonly models: readonly string[]
  stream(input: StreamInput): AsyncIterable<string>
  structured<T>(input: StructuredInput<T>): Promise<T>
  search(input: SearchInput): Promise<SearchResult>
}

export type ProviderMap = ReadonlyMap<ProviderId, Provider>

export class ProviderError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
    this.name = 'ProviderError'
  }
}

export function keyNameFor(providerId: ProviderId): string {
  switch (providerId) {
    case 'openai':
      return 'OPENAI_API_KEY'
    case 'anthropic':
      return 'ANTHROPIC_API_KEY'
    case 'gemini':
      return 'GEMINI_API_KEY'
  }
}
