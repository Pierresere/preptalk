import type { Config } from '../config.js'
import type { ProviderId } from '../domain/types.js'
import { createAnthropicProvider } from './anthropic.js'
import { createGeminiProvider } from './gemini.js'
import { createOpenAiProvider } from './openai.js'
import { withMasking } from './masked.js'
import type { Provider, ProviderMap } from './types.js'

export function createProviders(config: Config): ProviderMap {
  const map = new Map<ProviderId, Provider>()
  if (config.keys.anthropic !== undefined) map.set('anthropic', withMasking(createAnthropicProvider(config.keys.anthropic)))
  if (config.keys.openai !== undefined) map.set('openai', withMasking(createOpenAiProvider(config.keys.openai)))
  if (config.keys.gemini !== undefined) map.set('gemini', withMasking(createGeminiProvider(config.keys.gemini)))
  return map
}
