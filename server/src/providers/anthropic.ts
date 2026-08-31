import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import {
  ProviderError,
  type Provider,
  type SearchInput,
  type SearchResult,
  type StreamInput,
  type StructuredInput,
} from './types.js'

const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const

export function extractSearch(content: readonly Anthropic.ContentBlock[]): SearchResult {
  const text: string[] = []
  const sources: string[] = []
  for (const block of content) {
    if (block.type === 'text') text.push(block.text)
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const item of block.content) if (item.type === 'web_search_result') sources.push(item.url)
    }
  }
  return { text: text.join('\n'), sources: [...new Set(sources)] }
}

function toMessages(messages: StreamInput['messages']): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.text }))
}

function describeError(error: unknown): ProviderError {
  if (error instanceof Anthropic.APIError) return new ProviderError(`Anthropic: ${error.message}`, error.status ?? 502)
  return new ProviderError(error instanceof Error ? error.message : 'Anthropic request failed')
}

export function createAnthropicProvider(apiKey: string): Provider {
  const client = new Anthropic({ apiKey })
  return {
    id: 'anthropic',
    models: MODELS,
    async *stream(input: StreamInput) {
      try {
        // Note: `temperature` is intentionally NOT forwarded here (unlike the gemini/openai
        // adapters) — Claude 5 models reject the `temperature` parameter on this endpoint.
        const stream = client.messages.stream(
          { model: input.model, max_tokens: 8192, system: input.system, messages: toMessages(input.messages) },
          { signal: input.signal },
        )
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
        }
      } catch (error) {
        throw describeError(error)
      }
    },
    async structured<T>(input: StructuredInput<T>): Promise<T> {
      try {
        const response = await client.messages.parse(
          {
            model: input.model,
            max_tokens: 16000,
            system: input.system,
            messages: [{ role: 'user', content: input.prompt }],
            output_config: { format: zodOutputFormat(input.schema) },
          },
          { signal: input.signal },
        )
        if (response.parsed_output === null || response.parsed_output === undefined) {
          throw new ProviderError('Anthropic returned no structured output')
        }
        return input.schema.parse(response.parsed_output)
      } catch (error) {
        throw describeError(error)
      }
    },
    async search(input: SearchInput): Promise<SearchResult> {
      try {
        const response = await client.messages.create(
          {
            model: input.model,
            max_tokens: 4096,
            tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
            messages: [{ role: 'user', content: input.query }],
          },
          { signal: input.signal },
        )
        return extractSearch(response.content)
      } catch (error) {
        throw describeError(error)
      }
    },
  }
}
