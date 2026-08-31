import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'
import { readConfig } from './config.js'
import { createProviders } from './providers/registry.js'
import { DossierStore } from './storage/dossiers.js'
import { SessionStore } from './storage/sessions.js'

const config = readConfig(process.env)
const app = createApp({
  config,
  providers: createProviders(config),
  dossiers: new DossierStore(config.dataDir),
  sessions: new SessionStore(config.dataDir),
})
app.use('/*', serveStatic({ root: '../web/dist' }))
app.get('*', serveStatic({ path: '../web/dist/index.html' }))
serve({ fetch: app.fetch, port: config.port })
process.stdout.write(`PrepTalk server on http://localhost:${config.port}\n`)
