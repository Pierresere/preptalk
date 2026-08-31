import { Hono } from 'hono'
import type { AppDeps } from '../app.js'
import { ProviderError } from '../providers/types.js'
import type { ProviderId } from '../domain/types.js'
import { AnalysisSchema } from '../domain/types.js'
import { SECTION_IDS, type SectionId } from '../domain/sections.js'
import { researchAll, researchSection } from '../pipeline/research.js'
import { analyze } from '../pipeline/analysis.js'
import { generatePlan } from '../pipeline/plan.js'

function keyNameFor(providerId: ProviderId): string {
  switch (providerId) {
    case 'openai':
      return 'OPENAI_API_KEY'
    case 'anthropic':
      return 'ANTHROPIC_API_KEY'
    case 'gemini':
      return 'GEMINI_API_KEY'
  }
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
      signal: c.req.raw.signal,
    })
    await store.writeJson(id, 'plan', plan)
    return c.json(plan)
  })

  return app
}
