import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'
import { readConfig } from './config.js'

const config = readConfig(process.env)
const app = createApp({ config, providers: new Map() })
app.use('/*', serveStatic({ root: '../web/dist' }))
app.get('*', serveStatic({ path: '../web/dist/index.html' }))
serve({ fetch: app.fetch, port: config.port })
process.stdout.write(`PrepTalk server on http://localhost:${config.port}\n`)
