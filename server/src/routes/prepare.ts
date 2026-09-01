import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { AppDeps } from '../app.js'
import { ProviderError, keyNameFor } from '../providers/types.js'
import type { ProviderId } from '../domain/types.js'
import { AnalysisSchema, ConfirmedNameSchema } from '../domain/types.js'
import { personalDataOf, detect } from '../domain/privacy.js'
import { suggestNames } from '../domain/suggest.js'
import { SECTION_IDS, type SectionId } from '../domain/sections.js'
import { researchAll, researchSection } from '../pipeline/research.js'
import { analyze } from '../pipeline/analysis.js'
import { generatePlan } from '../pipeline/plan.js'

const PrivacyBodySchema = z.object({ names: z.array(ConfirmedNameSchema) })

function badRequest(c: Context, issue: z.ZodError): Response {
  return c.json({ error: issue.flatten() }, 400)
}

function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value)
}

function getProvider(deps: Pick<AppDeps, 'providers'>, providerId: ProviderId) {
  const provider = deps.providers.get(providerId)
  if (!provider) throw new ProviderError(`Missing key: ${keyNameFor(providerId)}`, 400)
  return provider
}

export function createPrepareRoute(deps: Pick<AppDeps, 'dossiers' | 'providers'>): Hono {
  const app = new Hono()
  const store = deps.dossiers

  app.post('/api/dossiers/:id/company/research', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const provider = getProvider(deps, dossier.provider)
    const company = await researchAll(provider, dossier, () => {}, c.req.raw.signal)
    await store.writeText(id, 'company', company)
    return c.json({ company })
  })

  app.post('/api/dossiers/:id/company/research/:section', async (c) => {
    const section = c.req.param('section')
    if (!isSectionId(section)) return c.json({ error: `Unknown section: ${section}` }, 400)
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const provider = getProvider(deps, dossier.provider)
    const current = await store.readText(id, 'company')
    const company = await researchSection(provider, dossier, section, current, c.req.raw.signal)
    await store.writeText(id, 'company', company)
    return c.json({ company })
  })

  app.post('/api/dossiers/:id/analysis', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const provider = getProvider(deps, dossier.provider)
    const [offer, resume] = await Promise.all([store.readText(id, 'offer'), store.readText(id, 'resume')])
    const analysis = await analyze({
      provider,
      model: dossier.model,
      offer,
      resume,
      language: dossier.language,
      personal: personalDataOf(dossier, (await store.readPrivacy(id))?.names ?? []),
      signal: c.req.raw.signal,
    })
    await store.writeJson(id, 'analysis', analysis)
    return c.json(analysis)
  })

  app.post('/api/dossiers/:id/plan', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const provider = getProvider(deps, dossier.provider)
    const [offer, resume, company, analysis] = await Promise.all([
      store.readText(id, 'offer'),
      store.readText(id, 'resume'),
      store.readText(id, 'company'),
      store.readJson(id, 'analysis', AnalysisSchema),
    ])
    const plan = await generatePlan({
      provider,
      model: dossier.model,
      dossier,
      offer,
      resume,
      company,
      analysis,
      personal: personalDataOf(dossier, (await store.readPrivacy(id))?.names ?? []),
      signal: c.req.raw.signal,
    })
    await store.writeJson(id, 'plan', plan)
    return c.json(plan)
  })

  app.get('/api/dossiers/:id/privacy', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const [resume, offer, confirmed] = await Promise.all([
      store.readText(id, 'resume'),
      store.readText(id, 'offer'),
      store.readPrivacy(id),
    ])
    const keep = [dossier.company, dossier.position]
    const suggested = suggestNames(resume, offer, keep)
    const personal = personalDataOf(dossier, confirmed?.names ?? suggested)
    return c.json({
      suggested,
      detected: detect(`${resume}\n${offer}`, personal),
      confirmed: confirmed?.names ?? null,
    })
  })

  app.put('/api/dossiers/:id/privacy', async (c) => {
    const id = c.req.param('id')
    await store.read(id)
    const parsed = PrivacyBodySchema.safeParse(await c.req.json())
    if (!parsed.success) return badRequest(c, parsed.error)
    const privacy = { names: parsed.data.names, reviewedAt: new Date().toISOString() }
    await store.writePrivacy(id, privacy)
    return c.json(privacy)
  })

  return app
}
