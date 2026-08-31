import { Hono } from 'hono'
import type { Config } from './config.js'
import type { ProviderMap } from './providers/types.js'
import type { DossierStore } from './storage/dossiers.js'
import type { SessionStore } from './storage/sessions.js'
import { createDossiersRoute } from './routes/dossiers.js'
import { createProvidersRoute } from './routes/providers.js'

export interface AppDeps {
  readonly config: Config
  readonly providers: ProviderMap
  readonly dossiers: DossierStore
  readonly sessions: SessionStore
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ ok: true }))
  app.route('/', createProvidersRoute(deps))
  app.route('/', createDossiersRoute(deps))
  app.onError((error, c) => {
    const status = typeof (error as unknown as { status?: unknown }).status === 'number' ? (error as unknown as { status: number }).status : 500
    return c.json({ error: error.message }, status as unknown as 400 | 404 | 422 | 500 | 502)
  })
  return app
}
