import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import { readConfig } from '../../src/config.js'
import { DossierStore } from '../../src/storage/dossiers.js'
import { SessionStore } from '../../src/storage/sessions.js'
import { FakeProvider } from '../../src/providers/fake.js'
import { PlanSchema, type Plan } from '../../src/domain/types.js'
import type { Hono } from 'hono'

let dataDir: string
let app: Hono
let dossiers: DossierStore

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preptalk-sessions-'))
  const providers = new Map([['gemini', new FakeProvider({ stream: 'hello there' })] as const])
  dossiers = new DossierStore(dataDir)
  app = createApp({
    config: readConfig({ DATA_DIR: dataDir }),
    providers,
    dossiers,
    sessions: new SessionStore(dataDir),
  })
})

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true })
})

const createBody = {
  company: 'Acme Corp',
  position: 'Engineer',
  sites: ['https://acme.example'],
  language: 'en',
  provider: 'gemini',
  model: 'fake',
}

const minimalPlan: Plan = PlanSchema.parse({
  persona: { name: 'Jane', role: 'Manager', concerns: 'delivery', tone: 'friendly' },
  phases: [
    {
      id: 'intro',
      title: 'Introduction',
      questions: 1,
      objective: 'Get to know the candidate',
      targeting: ['background'],
      examples: ['Tell me about yourself'],
    },
  ],
})

async function createDossier() {
  const res = await app.request('/api/dossiers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(createBody),
  })
  return res.json()
}

describe('session routes', () => {
  it('creates a session', async () => {
    const dossier = await createDossier()
    const res = await app.request(`/api/dossiers/${dossier.id}/sessions`, { method: 'POST' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.dossierId).toBe(dossier.id)
    expect(body.messages).toEqual([])
  })

  it('lists sessions', async () => {
    const dossier = await createDossier()
    await app.request(`/api/dossiers/${dossier.id}/sessions`, { method: 'POST' })
    const res = await app.request(`/api/dossiers/${dossier.id}/sessions`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })

  it('gets a session by id', async () => {
    const dossier = await createDossier()
    const created = await (
      await app.request(`/api/dossiers/${dossier.id}/sessions`, { method: 'POST' })
    ).json()
    const res = await app.request(`/api/dossiers/${dossier.id}/sessions/${created.id}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(created.id)
  })

  it('streams a turn as SSE with stage, chunk, and done events', async () => {
    const dossier = await createDossier()
    await dossiers.writeJson(dossier.id, 'plan', minimalPlan)
    await dossiers.writePrivacy(dossier.id, { names: [], reviewedAt: '2026-01-01T00:00:00.000Z' })
    const created = await (
      await app.request(`/api/dossiers/${dossier.id}/sessions`, { method: 'POST' })
    ).json()

    const res = await app.request(`/api/dossiers/${dossier.id}/sessions/${created.id}/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Tell me about yourself' }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/)
    const text = await res.text()
    expect(text).toContain('event: stage')
    expect(text).toContain('event: chunk')
    expect(text).toContain('event: done')
  })

  it('rejects an empty turn body', async () => {
    const dossier = await createDossier()
    const created = await (
      await app.request(`/api/dossiers/${dossier.id}/sessions`, { method: 'POST' })
    ).json()
    const res = await app.request(`/api/dossiers/${dossier.id}/sessions/${created.id}/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('streams an error event when the dossier has no plan', async () => {
    const dossier = await createDossier()
    const created = await (
      await app.request(`/api/dossiers/${dossier.id}/sessions`, { method: 'POST' })
    ).json()

    const res = await app.request(`/api/dossiers/${dossier.id}/sessions/${created.id}/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Tell me about yourself' }),
    })

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('event: error')
    expect(text).toContain('Generate the plan first')
  })
})
