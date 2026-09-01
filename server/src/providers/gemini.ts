import { ApiError, GoogleGenAI } from '@google/genai'
import {
  ProviderError,
  type Provider,
  type SearchInput,
  type SearchResult,
  type StreamInput,
  type StructuredInput,
} from './types.js'

const MODELS = ['gemini-3.7-flash', 'gemini-3.7-pro'] as const

export function extractGrounding(metadata: unknown): string[] {
  if (typeof metadata !== 'object' || metadata === null) return []
  const chunks = (metadata as { groundingChunks?: unknown }).groundingChunks
  if (!Array.isArray(chunks)) return []
  const urls: string[] = []
  for (const chunk of chunks) {
    if (typeof chunk !== 'object' || chunk === null) continue
    const web = (chunk as { web?: unknown }).web
    if (typeof web !== 'object' || web === null) continue
    const uri = (web as { uri?: unknown }).uri
    if (typeof uri === 'string') urls.push(uri)
  }
  return [...new Set(urls)]
}

function toContents(messages: StreamInput['messages']): Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> {
  return messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }))
}

function describeError(error: unknown): ProviderError {
  if (error instanceof ApiError) return new ProviderError(`Gemini: ${error.message}`, error.status ?? 502)
  return new ProviderError(error instanceof Error ? `Gemini: ${error.message}` : 'Gemini request failed')
}

export function createGeminiProvider(apiKey: string): Provider {
  const ai = new GoogleGenAI({ apiKey })
  return {
    id: 'gemini',
    models: MODELS,
    async *stream(input: StreamInput) {
      try {
        const stream = await ai.models.generateContentStream({
          model: input.model,
          contents: toContents(input.messages),
          config: {
            systemInstruction: input.system,
            temperature: input.temperature,
            maxOutputTokens: 8192,
            abortSignal: input.signal,
          },
        })
        for await (const chunk of stream) {
          if (chunk.text) yield chunk.text
        }
      } catch (error) {
        throw describeError(error)
      }
    },
    async structured<T>(input: StructuredInput<T>): Promise<T> {
      try {
        return await requestStructured(ai, input, input.prompt)
      } catch (error) {
        throw describeError(error)
      }
    },
    async search(input: SearchInput): Promise<SearchResult> {
      try {
        const response = await ai.models.generateContent({
          model: input.model,
          contents: input.query,
          config: { tools: [{ googleSearch: {} }], abortSignal: input.signal },
        })
        return { text: response.text ?? '', sources: extractGrounding(response.candidates?.[0]?.groundingMetadata) }
      } catch (error) {
        throw describeError(error)
      }
    },
  }
}

async function requestStructured<T>(ai: GoogleGenAI, input: StructuredInput<T>, prompt: string): Promise<T> {
  const response = await ai.models.generateContent({
    model: input.model,
    contents: prompt,
    config: { systemInstruction: input.system, responseMimeType: 'application/json', abortSignal: input.signal },
  })
  const parsed = tryParse(response.text)
  const result = parsed === undefined ? undefined : input.schema.safeParse(parsed)
  if (result?.success) return result.data
  const issues = result === undefined ? 'invalid JSON' : result.error.message
  const retryPrompt = `${prompt}\n\nPrevious answer was invalid: ${issues}. Return only valid JSON.`
  const retryResponse = await ai.models.generateContent({
    model: input.model,
    contents: retryPrompt,
    config: { systemInstruction: input.system, responseMimeType: 'application/json', abortSignal: input.signal },
  })
  const retryParsed = tryParse(retryResponse.text)
  const retryResult = retryParsed === undefined ? undefined : input.schema.safeParse(retryParsed)
  if (retryResult?.success) return retryResult.data
  throw new ProviderError('Gemini returned invalid JSON')
}

function tryParse(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? '')
  } catch {
    return undefined
  }
}
