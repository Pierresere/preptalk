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

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preptalk-routes-'))
  const providers = new Map([['gemini', new FakeProvider({})] as const])
  app = createApp({
    config: readConfig({ DATA_DIR: dataDir }),
    providers,
    dossiers: new DossierStore(dataDir),
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

describe('GET /api/providers', () => {
  it('lists configured providers', async () => {
    const res = await app.request('/api/providers')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'gemini', models: ['fake'] }])
  })
})

describe('dossier routes', () => {
  it('creates a dossier with a slug id', async () => {
    const res = await app.request('/api/dossiers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(createBody),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('acme-corp')
    expect(body.company).toBe('Acme Corp')
  })

  it('rejects an invalid create body', async () => {
    const res = await app.request('/api/dossiers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ company: '' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('lists dossiers', async () => {
    await app.request('/api/dossiers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(createBody),
    })
    const res = await app.request('/api/dossiers')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })

  it('gets the aggregate view and reflects offer text updates', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const putRes = await app.request(`/api/dossiers/${created.id}/offer`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Job offer text' }),
    })
    expect(putRes.status).toBe(204)

    const getRes = await app.request(`/api/dossiers/${created.id}`)
    expect(getRes.status).toBe(200)
    const body = await getRes.json()
    expect(body.dossier.id).toBe(created.id)
    expect(body.offer).toBe('Job offer text')
    expect(body.resume).toBe('')
    expect(body.company).toBe('')
    expect(body.documents).toEqual([])
    expect(body.analysis).toBeNull()
    expect(body.plan).toBeNull()
  })

  it('returns 404 for an unknown dossier id', async () => {
    const res = await app.request('/api/dossiers/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('patches a dossier', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const res = await app.request(`/api/dossiers/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ position: 'Senior Engineer' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.position).toBe('Senior Engineer')
  })

  it('deletes a dossier', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const res = await app.request(`/api/dossiers/${created.id}`, { method: 'DELETE' })
    expect(res.status).toBe(204)

    const getRes = await app.request(`/api/dossiers/${created.id}`)
    expect(getRes.status).toBe(404)
  })

  it('adds and removes a document', async () => {
    const created = await (
      await app.request('/api/dossiers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createBody),
      })
    ).json()

    const addRes = await app.request(`/api/dossiers/${created.id}/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'notes.md', text: 'notes content' }),
    })
    expect(addRes.status).toBe(201)

    const getRes = await app.request(`/api/dossiers/${created.id}`)
    const body = await getRes.json()
    expect(body.documents).toEqual([{ name: 'notes.md', chars: 'notes content'.length }])

    const delRes = await app.request(`/api/dossiers/${created.id}/documents/notes.md`, {
      method: 'DELETE',
    })
    expect(delRes.status).toBe(204)
  })
})
