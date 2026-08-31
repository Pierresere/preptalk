import type { Config } from '../config.js'
import type { ProviderId } from '../domain/types.js'
import { createAnthropicProvider } from './anthropic.js'
import type { Provider, ProviderMap } from './types.js'

export function createProviders(config: Config): ProviderMap {
  const map = new Map<ProviderId, Provider>()
  if (config.keys.anthropic !== undefined) map.set('anthropic', createAnthropicProvider(config.keys.anthropic))
  return map
}
