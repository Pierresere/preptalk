import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import { readConfig } from '../../src/config.js'
import { DossierStore } from '../../src/storage/dossiers.js'
import { SessionStore } from '../../src/storage/sessions.js'
import { FakeProvider } from '../../src/providers/fake.js'
import type { Hono } from 'hono'

let dataDir: string
let app: Hono
let store: DossierStore

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preptalk-prepare-'))
  const providers = new Map([
    ['gemini', new FakeProvider({ search: { text: 'Ropes and slings.', sources: ['https://a'] } })] as const,
  ])
  store = new DossierStore(dataDir)
  app = createApp({
    config: readConfig({ DATA_DIR: dataDir }),
    providers,
    dossiers: store,
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

describe('POST /api/dossiers/:id/company/research/:section', () => {
  it('researches one section and persists company.md', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const res = await app.request(`/api/dossiers/${created.id}/company/research/products`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.company).toContain('## Products and services')
    expect(body.company).toContain('Ropes and slings.')

    const onDisk = await store.readText(created.id, 'company')
    expect(onDisk).toBe(body.company)
  })

  it('rejects an unknown section id', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const res = await app.request(`/api/dossiers/${created.id}/company/research/bogus`, {
      method: 'POST',
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/dossiers/:id/analysis', () => {
  it('analyzes offer vs resume and persists analysis.json', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const analysis = {
      requirements: [
        {
          index: 0,
          text: 'Manage a team of engineers',
          keywords: ['team management'],
          status: 'covered' as const,
          evidence: 'Led a team of five engineers for two years.',
        },
      ],
      summary: 'Strong overall match. Team management is well covered. Some gaps remain elsewhere.',
    }
    const providers = new Map([['gemini', new FakeProvider({ structured: analysis })] as const])
    app = createApp({
      config: readConfig({ DATA_DIR: dataDir }),
      providers,
      dossiers: store,
      sessions: new SessionStore(dataDir),
    })

    const offer = 'We are looking for a senior engineer with strong leadership skills. '.repeat(2)
    const resume = 'Experienced engineer who led teams and delivered projects on time. '.repeat(2)
    await store.writeText(created.id, 'offer', offer)
    await store.writeText(created.id, 'resume', resume)

    const res = await app.request(`/api/dossiers/${created.id}/analysis`, { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(analysis)

    const onDisk = await store.readJson(created.id, 'analysis', z.unknown())
    expect(onDisk).toEqual(analysis)
  })

  it('rejects an empty offer with 400', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const res = await app.request(`/api/dossiers/${created.id}/analysis`, { method: 'POST' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/dossiers/:id/company/research', () => {
  it('researches all sections', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const res = await app.request(`/api/dossiers/${created.id}/company/research`, { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.company).toContain('## Sector')
    expect(body.company).toContain('## Competitors')
  })
})

describe('privacy routes', () => {
  it('suggests names then stores the confirmed list', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()
    await store.writeText(created.id, 'resume', 'Pierre Séré\nCoordonnateur qualité\n')

    const get = await app.request(`/api/dossiers/${created.id}/privacy`)
    expect(get.status).toBe(200)
    const body = (await get.json()) as { suggested: { value: string }[]; confirmed: unknown }
    expect(body.suggested).toContainEqual({ value: 'Pierre Séré', kind: 'candidate' })
    expect(body.confirmed).toBeNull()

    const put = await app.request(`/api/dossiers/${created.id}/privacy`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ names: [{ value: 'Pierre Séré', kind: 'candidate' }] }),
    })
    expect(put.status).toBe(200)
    expect((await store.readPrivacy(created.id))?.names).toHaveLength(1)
  })
})
