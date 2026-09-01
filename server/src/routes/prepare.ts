import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { AppDeps } from '../app.js'
import { ProviderError, keyNameFor } from '../providers/types.js'
import type { Dossier, ProviderId } from '../domain/types.js'
import type { DossierStore } from '../storage/dossiers.js'
import type { PersonalData } from '../domain/privacy.js'
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

/** Company research plus every uploaded document — the rest of what a prompt carries. */
async function readReviewExtras(store: DossierStore, id: string): Promise<string> {
  const [company, entries] = await Promise.all([store.readText(id, 'company'), store.listDocuments(id)])
  const documents = await Promise.all(entries.map((doc) => store.readDocument(id, doc.name)))
  return [company, ...documents].join('\n')
}

/**
 * The privacy review is the gate: without a stored `privacy.json` the dossier has never
 * been reviewed, so nothing may be sent to a provider. A missing record is a refusal,
 * never an empty masking list.
 */
async function requirePersonal(store: DossierStore, dossier: Dossier): Promise<PersonalData> {
  const privacy = await store.readPrivacy(dossier.id)
  if (!privacy) throw new ProviderError('Review the privacy list first', 409)
  return personalDataOf(dossier, privacy.names)
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
    const personal = await requirePersonal(store, dossier)
    const company = await researchAll(provider, dossier, () => {}, personal, c.req.raw.signal)
    await store.writeText(id, 'company', company)
    return c.json({ company })
  })

  app.post('/api/dossiers/:id/company/research/:section', async (c) => {
    const section = c.req.param('section')
    if (!isSectionId(section)) return c.json({ error: `Unknown section: ${section}` }, 400)
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const provider = getProvider(deps, dossier.provider)
    const personal = await requirePersonal(store, dossier)
    const current = await store.readText(id, 'company')
    const company = await researchSection(provider, dossier, section, current, personal, c.req.raw.signal)
    await store.writeText(id, 'company', company)
    return c.json({ company })
  })

  app.post('/api/dossiers/:id/analysis', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const provider = getProvider(deps, dossier.provider)
    const personal = await requirePersonal(store, dossier)
    const [offer, resume] = await Promise.all([store.readText(id, 'offer'), store.readText(id, 'resume')])
    const analysis = await analyze({
      provider,
      model: dossier.model,
      offer,
      resume,
      language: dossier.language,
      personal,
      signal: c.req.raw.signal,
    })
    await store.writeJson(id, 'analysis', analysis)
    return c.json(analysis)
  })

  app.post('/api/dossiers/:id/plan', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const provider = getProvider(deps, dossier.provider)
    const personal = await requirePersonal(store, dossier)
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
      personal,
      signal: c.req.raw.signal,
    })
    await store.writeJson(id, 'plan', plan)
    return c.json(plan)
  })

  app.get('/api/dossiers/:id/privacy', async (c) => {
    const id = c.req.param('id')
    const dossier = await store.read(id)
    const [resume, offer, confirmed, extras] = await Promise.all([
      store.readText(id, 'resume'),
      store.readText(id, 'offer'),
      store.readPrivacy(id),
      readReviewExtras(store, id),
    ])
    const keep = [dossier.company, dossier.position]
    // The review must cover everything the model receives: company research and uploaded
    // documents reach the prompt through `pipeline/interview.ts`, just like resume and offer.
    const suggested = suggestNames(resume, `${offer}\n${extras}`, keep)
    const personal = personalDataOf(dossier, confirmed?.names ?? suggested)
    return c.json({
      suggested,
      detected: detect(`${resume}\n${offer}\n${extras}`, personal),
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
