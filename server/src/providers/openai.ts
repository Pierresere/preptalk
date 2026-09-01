import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type { ResponseOutputItem } from 'openai/resources/responses/responses'
import {
  ProviderError,
  type Provider,
  type SearchInput,
  type SearchResult,
  type StreamInput,
  type StructuredInput,
} from './types.js'

const MODELS = ['gpt-5.6-luna', 'gpt-5.6', 'gpt-5.6-mini'] as const

export function extractCitations(output: readonly ResponseOutputItem[]): string[] {
  const urls: string[] = []
  for (const item of output) {
    if (item.type !== 'message') continue
    for (const part of item.content) {
      if (part.type !== 'output_text') continue
      for (const annotation of part.annotations) {
        if (annotation.type === 'url_citation') urls.push(annotation.url)
      }
    }
  }
  return [...new Set(urls)]
}

function toInput(messages: StreamInput['messages']): OpenAI.Responses.ResponseInputItem[] {
  return messages.map((m) => ({ role: m.role, content: m.text }))
}

function describeError(error: unknown): ProviderError {
  if (error instanceof OpenAI.APIError) return new ProviderError(`OpenAI: ${error.message}`, error.status ?? 502)
  return new ProviderError(error instanceof Error ? error.message : 'OpenAI request failed')
}

export function createOpenAiProvider(apiKey: string): Provider {
  const client = new OpenAI({ apiKey })
  return {
    id: 'openai',
    models: MODELS,
    async *stream(input: StreamInput) {
      try {
        const stream = await client.responses.create(
          {
            model: input.model,
            instructions: input.system,
            input: toInput(input.messages),
            temperature: input.temperature,
            stream: true,
          },
          { signal: input.signal },
        )
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') yield event.delta
        }
      } catch (error) {
        throw describeError(error)
      }
    },
    async structured<T>(input: StructuredInput<T>): Promise<T> {
      try {
        const response = await client.responses.parse(
          {
            model: input.model,
            instructions: input.system,
            input: input.prompt,
            text: { format: zodTextFormat(input.schema, 'result') },
          },
          { signal: input.signal },
        )
        if (response.output_parsed === null || response.output_parsed === undefined) {
          throw new ProviderError('OpenAI returned no structured output')
        }
        return input.schema.parse(response.output_parsed)
      } catch (error) {
        throw describeError(error)
      }
    },
    async search(input: SearchInput): Promise<SearchResult> {
      try {
        const response = await client.responses.create(
          {
            model: input.model,
            tools: [{ type: 'web_search' }],
            input: input.query,
          },
          { signal: input.signal },
        )
        return { text: response.output_text, sources: extractCitations(response.output) }
      } catch (error) {
        throw describeError(error)
      }
    },
  }
}
