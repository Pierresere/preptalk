import { Hono } from 'hono'
import type { Config } from './config.js'

export interface AppDeps {
  readonly config: Config
  readonly providers: ReadonlyMap<string, unknown>
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ ok: true }))
  void deps
  return app
}
