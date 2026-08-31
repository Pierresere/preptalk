import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
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
