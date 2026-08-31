import { Hono } from 'hono'
import type { AppDeps } from '../app.js'

export function createProvidersRoute(deps: Pick<AppDeps, 'providers'>): Hono {
  const app = new Hono()

  app.get('/api/providers', (c) => {
    const providers = [...deps.providers.values()].map((provider) => ({
      id: provider.id,
      models: provider.models,
    }))
    return c.json(providers)
  })

  return app
}
