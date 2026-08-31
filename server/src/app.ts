import { Hono } from 'hono'
import type { Config } from './config.js'
import type { ProviderMap } from './providers/types.js'

export interface AppDeps {
  readonly config: Config
  readonly providers: ProviderMap
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ ok: true }))
  void deps
  return app
}
