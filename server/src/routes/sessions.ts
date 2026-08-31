import { Hono, type Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { AppDeps } from '../app.js'
import { runTurn } from '../pipeline/interview.js'

const TurnBodySchema = z.object({ text: z.string().min(1) })

function badRequest(c: Context, issue: z.ZodError): Response {
  return c.json({ error: issue.flatten() }, 400)
}

export function createSessionsRoute(deps: Pick<AppDeps, 'dossiers' | 'sessions' | 'providers'>): Hono {
  const app = new Hono()
  const { dossiers, sessions, providers } = deps

  app.get('/api/dossiers/:id/sessions', async (c) => {
    return c.json(await sessions.list(c.req.param('id')))
  })

  app.post('/api/dossiers/:id/sessions', async (c) => {
    const dossier = await dossiers.read(c.req.param('id'))
    const session = await sessions.create(dossier)
    return c.json(session, 201)
  })

  app.get('/api/dossiers/:id/sessions/:sid', async (c) => {
    const session = await sessions.read(c.req.param('id'), c.req.param('sid'))
    return c.json(session)
  })

  app.post('/api/dossiers/:id/sessions/:sid/turn', async (c) => {
    const parsed = TurnBodySchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error)
    const dossierId = c.req.param('id')
    const sessionId = c.req.param('sid')
    const userText = parsed.data.text
    const signal = c.req.raw.signal

    return streamSSE(c, async (stream) => {
      try {
        const session = await runTurn(
          { dossiers, sessions, providers },
          { dossierId, sessionId, userText, signal },
          {
            onStage: async (stage) => {
              await stream.writeSSE({ event: 'stage', data: JSON.stringify({ stage }) })
            },
            onSources: async (ids) => {
              await stream.writeSSE({ event: 'sources', data: JSON.stringify({ ids }) })
            },
            onDelta: async (delta) => {
              await stream.writeSSE({ event: 'chunk', data: JSON.stringify({ delta }) })
            },
          }
        )
        await stream.writeSSE({ event: 'done', data: JSON.stringify({ session }) })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ message }) })
      }
    })
  })

  return app
}
