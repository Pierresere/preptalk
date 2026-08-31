import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { buildChunks } from '../../src/pipeline/chunks.js'
import { runTurn } from '../../src/pipeline/interview.js'
import { DossierStore } from '../../src/storage/dossiers.js'
import { SessionStore } from '../../src/storage/sessions.js'
import { FakeProvider } from '../../src/providers/fake.js'
import { ProviderError } from '../../src/providers/types.js'
import type { Analysis, Plan, Persona } from '../../src/domain/types.js'

const persona: Persona = {
  name: 'Jane Doe',
  role: 'Engineering Manager',
  concerns: 'Delivering on time.',
  tone: 'Direct.',
}

function makePlan(): Plan {
  return {
    persona,
    phases: [
      {
        id: 'welcome',
        title: 'Welcome',
        questions: 1,
        objective: 'Warm up',
        targeting: ['onboarding'],
        examples: ['Tell me about yourself'],
      },
      {
        id: 'core',
        title: 'Core',
        questions: 1,
        objective: 'Dig into skills',
        targeting: ['engineering'],
        examples: ['Describe a project'],
      },
    ],
  }
}

const analysis: Analysis = {
  requirements: [
    {
      index: 0,
      text: 'Manage a team of engineers',
      keywords: ['team management'],
      status: 'covered',
      evidence: 'Led a team of five engineers for two years.',
    },
  ],
  summary: 'Strong match.',
}

describe('buildChunks', () => {
  test('produces expected ids', () => {
    const chunks = buildChunks({
      offer: 'We need a senior engineer.',
      resume: 'Experienced engineer.',
      company: '## Sector\n\nWidgets.\n\n## Products and services\n\nGadgets.',
      documents: [{ name: 'notes.txt', text: 'Some notes.' }],
      analysis,
    })
    const ids = chunks.map((c) => c.id)
    expect(ids).toContain('offer')
    expect(ids).toContain('resume')
    expect(ids).toContain('company/sector')
    expect(ids).toContain('company/products')
    expect(ids).toContain('document/notes.txt')
    expect(ids).toContain('requirement/0')
    const requirement = chunks.find((c) => c.id === 'requirement/0')
    expect(requirement?.title).toBe('Requirement 0 (covered)')
    expect(requirement?.body).toContain('Manage a team of engineers')
    expect(requirement?.body).toContain('Led a team of five engineers for two years.')
  })

  test('skips empty-bodied chunks', () => {
    const chunks = buildChunks({
      offer: '',
      resume: '   ',
      company: '',
      documents: [{ name: 'empty.txt', text: '' }],
      analysis: null,
    })
    expect(chunks.map((c) => c.id)).toEqual([])
  })
})

describe('runTurn', () => {
  let dir: string
  let dossiers: DossierStore
  let sessions: SessionStore

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preptalk-interview-'))
    dossiers = new DossierStore(dir)
    sessions = new SessionStore(dir)
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  async function setup() {
    const dossier = await dossiers.create({
      company: 'Acme',
      position: 'Engineer',
      sites: ['https://acme.example'],
      language: 'en',
      provider: 'gemini',
      model: 'fake',
    })
    await dossiers.writeText(dossier.id, 'offer', 'We need a senior engineer.')
    await dossiers.writeText(dossier.id, 'resume', 'Experienced engineer.')
    await dossiers.writeText(dossier.id, 'company', '## Sector\n\nWidgets.')
    await dossiers.writeJson(dossier.id, 'plan', makePlan())
    const session = await sessions.create(dossier)
    return { dossier, session }
  }

  test('missing plan rejects with 409', async () => {
    const dossier = await dossiers.create({
      company: 'Acme',
      position: 'Engineer',
      sites: [],
      language: 'en',
      provider: 'gemini',
      model: 'fake',
    })
    const session = await sessions.create(dossier)
    const provider = new FakeProvider({ stream: 'Hello there.' })
    const providers = new Map([['gemini', provider]] as const)

    await expect(
      runTurn(
        { dossiers, sessions, providers },
        { dossierId: dossier.id, sessionId: session.id, userText: 'Hi', signal: new AbortController().signal },
        { onStage: () => {}, onSources: () => {}, onDelta: () => {} }
      )
    ).rejects.toMatchObject(new ProviderError('Generate the plan first', 409))
  })

  test('emits stages in order, saves session, includes Question 1 of in system', async () => {
    const { dossier, session } = await setup()
    const provider = new FakeProvider({ stream: 'Welcome, tell me about yourself.' })
    const providers = new Map([['gemini', provider]] as const)
    const stages: string[] = []
    const sourcesCalls: string[][] = []
    let delta = ''

    const updated = await runTurn(
      { dossiers, sessions, providers },
      { dossierId: dossier.id, sessionId: session.id, userText: '(start)', signal: new AbortController().signal },
      {
        onStage: (s) => stages.push(s),
        onSources: (ids) => sourcesCalls.push(ids),
        onDelta: (d) => (delta += d),
      }
    )

    expect(stages).toEqual(['retrieving', 'thinking'])
    expect(updated.messages).toHaveLength(2)
    expect(updated.messages[0]?.role).toBe('user')
    expect(updated.messages[1]?.role).toBe('assistant')
    expect(delta.length).toBeGreaterThan(0)
    expect(updated.messages[1]?.sources).toBeDefined()

    const call = provider.calls[0] as { input: { system: string } }
    expect(call.input.system).toContain('Question 1 of')

    const saved = await sessions.read(dossier.id, session.id)
    expect(saved.messages).toHaveLength(2)
  })

  test('debrief turn after totalQuestions assistant messages sets session.debrief', async () => {
    const { dossier, session } = await setup()
    const provider = new FakeProvider({ stream: 'Great answer.' })
    const providers = new Map([['gemini', provider]] as const)

    let current = session
    current.messages.push({ role: 'user', text: 'Answer 1' })
    current.messages.push({ role: 'assistant', text: 'Question 2', sources: [] })
    current.messages.push({ role: 'user', text: 'Answer 2' })
    current.messages.push({ role: 'assistant', text: 'Any final thoughts?', sources: [] })
    await sessions.save(current)

    const stages: string[] = []
    const updated = await runTurn(
      { dossiers, sessions, providers },
      { dossierId: dossier.id, sessionId: current.id, userText: 'Final answer', signal: new AbortController().signal },
      { onStage: (s) => stages.push(s), onSources: () => {}, onDelta: () => {} }
    )

    expect(stages).toEqual(['debrief', 'thinking'])
    expect(updated.debrief).toBe('Great answer.')
  })
})
