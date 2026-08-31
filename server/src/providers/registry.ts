import type { Config } from '../config.js'
import type { ProviderId } from '../domain/types.js'
import type { Provider, ProviderMap } from './types.js'

export function createProviders(config: Config): ProviderMap {
  void config
  const map = new Map<ProviderId, Provider>()
  return map
}
