import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { AppDeps } from '../app.js'
import { PlanSchema, LanguageSchema, ProviderIdSchema } from '../domain/types.js'

const CreateDossierSchema = z.object({
  company: z.string().min(1),
  position: z.string().min(1),
  sites: z.array(z.string()),
  language: LanguageSchema,
  provider: ProviderIdSchema,
  model: z.string().min(1),
})

const PatchDossierSchema = CreateDossierSchema.partial()

const TextBodySchema = z.object({ text: z.string() })

const DocumentBodySchema = z.object({ name: z.string().min(1), text: z.string() })

function badRequest(c: Context, issue: z.ZodError): Response {
  return c.json({ error: issue.flatten() }, 400)
}

export function createDossiersRoute(deps: Pick<AppDeps, 'dossiers'>): Hono {
  const app = new Hono()
  const store = deps.dossiers

  app.get('/api/dossiers', async (c) => c.json(await store.list()))

  app.post('/api/dossiers', async (c) => {
    const parsed = CreateDossierSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error)
    const dossier = await store.create(parsed.data)
    return c.json(dossier, 201)
  })

  app.get('/api/dossiers/:id', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const [offer, resume, company, documents, analysis, plan] = await Promise.all([
      store.readText(id, 'offer'),
      store.readText(id, 'resume'),
      store.readText(id, 'company'),
      store.listDocuments(id),
      store.readJson(id, 'analysis', z.unknown()),
      store.readJson(id, 'plan', PlanSchema),
    ])
    return c.json({ dossier, offer, resume, company, documents, analysis, plan })
  })

  app.patch('/api/dossiers/:id', async (c) => {
    const parsed = PatchDossierSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error)
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined))
    const dossier = await store.update(c.req.param('id'), patch)
    return c.json(dossier)
  })

  app.delete('/api/dossiers/:id', async (c) => {
    await store.remove(c.req.param('id'))
    return c.body(null, 204)
  })

  for (const name of ['offer', 'resume', 'company'] as const) {
    app.put(`/api/dossiers/:id/${name}`, async (c) => {
      const parsed = TextBodySchema.safeParse(await c.req.json())
      if (!parsed.success) return badRequest(c, parsed.error)
      await store.writeText(c.req.param('id'), name, parsed.data.text)
      return c.body(null, 204)
    })
  }

  app.put('/api/dossiers/:id/plan', async (c) => {
    const parsed = PlanSchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error)
    await store.writeJson(c.req.param('id'), 'plan', parsed.data)
    return c.body(null, 204)
  })

  app.post('/api/dossiers/:id/documents', async (c) => {
    const parsed = DocumentBodySchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error)
    await store.writeDocument(c.req.param('id'), parsed.data.name, parsed.data.text)
    return c.body(null, 201)
  })

  app.delete('/api/dossiers/:id/documents/:name', async (c) => {
    await store.removeDocument(c.req.param('id'), c.req.param('name'))
    return c.body(null, 204)
  })

  return app
}
