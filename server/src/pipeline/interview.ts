import { turnFromHistory, phaseForTurn } from '../domain/phases.js'
import { buildInterviewSystem } from '../domain/prompt.js'
import { personalDataOf } from '../domain/privacy.js'
import { selectChunks } from '../domain/retrieval.js'
import { AnalysisSchema, PlanSchema, type Session } from '../domain/types.js'
import { ProviderError, keyNameFor } from '../providers/types.js'
import type { ProviderMap } from '../providers/types.js'
import type { DossierStore } from '../storage/dossiers.js'
import type { SessionStore } from '../storage/sessions.js'
import { buildChunks } from './chunks.js'

export interface RunTurnDeps {
  readonly dossiers: DossierStore
  readonly sessions: SessionStore
  readonly providers: ProviderMap
}

export interface RunTurnInput {
  readonly dossierId: string
  readonly sessionId: string
  readonly userText: string
  readonly signal: AbortSignal
}

export type Stage = 'retrieving' | 'thinking' | 'debrief'

export interface RunTurnCallbacks {
  readonly onStage: (stage: Stage) => void
  readonly onSources: (ids: string[]) => void
  readonly onDelta: (delta: string) => void
}

async function loadContext(deps: RunTurnDeps, dossierId: string, sessionId: string) {
  const dossier = await deps.dossiers.read(dossierId)
  const session = await deps.sessions.read(dossierId, sessionId)
  const plan = await deps.dossiers.readJson(dossierId, 'plan', PlanSchema)
  if (!plan) throw new ProviderError('Generate the plan first', 409)
  const provider = deps.providers.get(dossier.provider)
  if (!provider) throw new ProviderError(`Missing key: ${keyNameFor(dossier.provider)}`, 400)
  return { dossier, session, plan, provider }
}

async function loadChunks(dossiers: DossierStore, dossierId: string) {
  const [offer, resume, company, analysis, documentEntries] = await Promise.all([
    dossiers.readText(dossierId, 'offer'),
    dossiers.readText(dossierId, 'resume'),
    dossiers.readText(dossierId, 'company'),
    dossiers.readJson(dossierId, 'analysis', AnalysisSchema),
    dossiers.listDocuments(dossierId),
  ])
  const documents = await Promise.all(
    documentEntries.map(async (doc) => ({ name: doc.name, text: await dossiers.readDocument(dossierId, doc.name) }))
  )
  return buildChunks({ offer, resume, company, documents, analysis })
}

export async function runTurn(
  deps: RunTurnDeps,
  input: RunTurnInput,
  callbacks: RunTurnCallbacks
): Promise<Session> {
  const { dossier, session, plan, provider } = await loadContext(deps, input.dossierId, input.sessionId)
  const privacy = await deps.dossiers.readPrivacy(input.dossierId)
  const turn = turnFromHistory(session.messages)
  const phase = phaseForTurn(plan, turn)
  const isDebrief = phase === null
  callbacks.onStage(isDebrief ? 'debrief' : 'retrieving')

  const query = isDebrief ? input.userText : `${input.userText} ${phase.targeting.join(' ')}`
  const chunks = await loadChunks(deps.dossiers, input.dossierId)
  const hits = selectChunks(chunks, query)
  const sourceIds = hits.map((hit) => hit.chunk.id)
  callbacks.onSources(sourceIds)

  const system = buildInterviewSystem({
    plan,
    turn,
    chunks: hits,
    language: dossier.language,
    company: dossier.company,
    position: dossier.position,
    candidate: 'the candidate',
  })
  const messages = [...session.messages.map((m) => ({ role: m.role, text: m.text })), { role: 'user' as const, text: input.userText }]

  callbacks.onStage('thinking')
  let text = ''
  for await (const delta of provider.stream({
    system,
    messages,
    personal: personalDataOf(dossier, privacy?.names ?? []),
    model: dossier.model,
    temperature: 0.85,
    signal: input.signal,
  })) {
    text += delta
    callbacks.onDelta(delta)
  }

  session.messages.push({ role: 'user', text: input.userText })
  session.messages.push({ role: 'assistant', text, sources: sourceIds })
  if (isDebrief) session.debrief = text
  await deps.sessions.save(session)
  return session
}
