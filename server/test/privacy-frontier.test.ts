import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { analyze } from '../src/pipeline/analysis.js'
import { runTurn } from '../src/pipeline/interview.js'
import { withMasking } from '../src/providers/masked.js'
import { FakeProvider } from '../src/providers/fake.js'
import { personalDataOf } from '../src/domain/privacy.js'
import { suggestNames } from '../src/domain/suggest.js'
import { DossierStore } from '../src/storage/dossiers.js'
import { SessionStore } from '../src/storage/sessions.js'
import { PlanSchema, type Dossier, type Plan } from '../src/domain/types.js'

const RESUME = `Pierre Séré
pierre.sere@example.com · 514-555-0123 · H2X 1Y4
https://www.linkedin.com/in/pierre-sere
Coordonnateur qualité depuis 2019 chez Câbles Ben-Mor.
Séré a piloté la certification ISO 9001:2015.
Sere a aussi formé les équipes de production.`

const OFFER = `Câbles Ben-Mor recrute un coordonnateur qualité expérimenté.
La certification ISO fait partie du mandat quotidien de ce poste.
Contact : Marie Tremblay, marie.tremblay@example.com`

const FORBIDDEN = [
  'Pierre Séré', 'Séré', 'Sere', 'pierre.sere@example.com', '514-555-0123', 'H2X 1Y4',
  'linkedin.com/in/pierre-sere', 'Marie Tremblay', 'marie.tremblay@example.com',
]

const PLAN: Plan = PlanSchema.parse({
  persona: { name: 'Jane', role: 'Manager', concerns: 'qualité', tone: 'direct' },
  phases: [
    {
      id: 'intro',
      title: 'Introduction',
      questions: 1,
      objective: 'Ouvrir la discussion',
      targeting: ['certification', 'qualité'],
      examples: ['Parlez-moi de vous'],
    },
  ],
})

function expectClean(payload: string): void {
  for (const value of FORBIDDEN) expect(payload).not.toContain(value)
  expect(payload).toContain('Câbles Ben-Mor')
  expect(payload).toContain('Coordonnateur qualité')
}

describe('provider frontier', () => {
  let dir: string
  let dossiers: DossierStore
  let sessions: SessionStore
  let dossier: Dossier

  /** Builds the confirmed list exactly the way the product does: suggest, persist, read back. */
  async function reviewedPersonal() {
    const keep = [dossier.company, dossier.position]
    const suggested = suggestNames(RESUME, OFFER, keep)
    await dossiers.writePrivacy(dossier.id, {
      names: suggested,
      reviewedAt: new Date().toISOString(),
    })
    const stored = await dossiers.readPrivacy(dossier.id)
    if (!stored) throw new Error('privacy.json was not persisted')
    return personalDataOf(dossier, stored.names)
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preptalk-frontier-'))
    dossiers = new DossierStore(dir)
    sessions = new SessionStore(dir)
    dossier = await dossiers.create({
      company: 'Câbles Ben-Mor',
      position: 'Coordonnateur qualité',
      sites: [],
      language: 'fr',
      provider: 'gemini',
      model: 'fake',
    })
    await dossiers.writeText(dossier.id, 'offer', OFFER)
    await dossiers.writeText(dossier.id, 'resume', RESUME)
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('never lets a personal value reach the provider through analyze', async () => {
    const fake = new FakeProvider({ structured: { requirements: [], summary: 'a. b. c.' } })
    await analyze({
      provider: withMasking(fake),
      model: 'fake',
      offer: OFFER,
      resume: RESUME,
      language: 'fr',
      personal: await reviewedPersonal(),
      signal: new AbortController().signal,
    })
    expectClean(JSON.stringify(fake.calls))
  })

  it('never lets a personal value reach the provider through runTurn', async () => {
    await reviewedPersonal()
    await dossiers.writeJson(dossier.id, 'plan', PLAN)
    const session = await sessions.create(dossier)
    const fake = new FakeProvider({ stream: 'Bonjour.' })
    const providers = new Map([['gemini', withMasking(fake)]] as const)

    await runTurn(
      { dossiers, sessions, providers },
      {
        dossierId: dossier.id,
        sessionId: session.id,
        userText: 'Séré, parlez-moi de la certification et du coordonnateur qualité',
        signal: new AbortController().signal,
      },
      { onStage: () => {}, onSources: () => {}, onDelta: () => {} }
    )

    const payload = JSON.stringify(fake.calls)
    expectClean(payload)
    // The resume really was in the prompt, so the absence assertions above mean something.
    expect(payload).toContain('certification')
  })
})
