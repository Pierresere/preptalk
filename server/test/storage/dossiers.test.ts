import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { DossierStore, slugify } from '../../src/storage/dossiers.js'
import { NotFoundError, CorruptFileError, InvalidNameError } from '../../src/storage/errors.js'
import { PlanSchema } from '../../src/domain/types.js'

describe('slugify', () => {
  test('lowercases, folds accents, replaces non-alphanumerics', () => {
    expect(slugify('Café Déjà Vu!')).toBe('cafe-deja-vu')
  })

  test('empty result falls back to dossier', () => {
    expect(slugify('!!!')).toBe('dossier')
  })
})

describe('DossierStore', () => {
  let dir: string
  let store: DossierStore

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'preptalk-'))
    store = new DossierStore(dir)
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  const input = {
    company: 'Acme',
    position: 'Engineer',
    sites: ['https://acme.example'],
    language: 'en' as const,
    provider: 'anthropic' as const,
    model: 'claude',
  }

  test('create then list returns the dossier', async () => {
    const created = await store.create(input)
    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(created.id)
  })

  test('slug uniqueness: Acme twice yields acme then acme-2', async () => {
    const first = await store.create(input)
    const second = await store.create(input)
    expect(first.id).toBe('acme')
    expect(second.id).toBe('acme-2')
  })

  test('read throws NotFoundError for missing dossier', async () => {
    await expect(store.read('missing')).rejects.toBeInstanceOf(NotFoundError)
  })

  test('readText offer.md is empty then round-trips', async () => {
    const created = await store.create(input)
    expect(await store.readText(created.id, 'offer')).toBe('')
    await store.writeText(created.id, 'offer', 'hello offer')
    expect(await store.readText(created.id, 'offer')).toBe('hello offer')
  })

  test('readJson plan is null then round-trips', async () => {
    const created = await store.create(input)
    expect(await store.readJson(created.id, 'plan', PlanSchema)).toBeNull()
    const plan = {
      persona: { name: 'A', role: 'B', concerns: 'C', tone: 'D' },
      phases: [
        { id: 'p1', title: 'Phase', questions: 3, objective: 'Assess fit', targeting: [], examples: [] },
      ],
    }
    await store.writeJson(created.id, 'plan', plan)
    const read = await store.readJson(created.id, 'plan', PlanSchema)
    expect(read).toEqual(plan)
  })

  test('corrupt dossier.json throws CorruptFileError', async () => {
    const created = await store.create(input)
    await fs.writeFile(path.join(dir, created.id, 'dossier.json'), '{not json', 'utf-8')
    await expect(store.read(created.id)).rejects.toBeInstanceOf(CorruptFileError)
  })

  test('remove deletes the dossier folder', async () => {
    const created = await store.create(input)
    await store.remove(created.id)
    await expect(store.read(created.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  test('update bumps updatedAt without changing id/createdAt', async () => {
    const created = await store.create(input)
    await new Promise((r) => setTimeout(r, 5))
    const updated = await store.update(created.id, { position: 'Senior Engineer' })
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt).not.toBe(created.updatedAt)
    expect(updated.position).toBe('Senior Engineer')
  })

  test('read rejects a path-traversal id', async () => {
    await expect(store.read('../evil')).rejects.toBeInstanceOf(InvalidNameError)
    await expect(store.read('../evil')).rejects.toMatchObject({ status: 400 })
  })

  test('document name ../x.md is rejected', async () => {
    const created = await store.create(input)
    await expect(store.writeDocument(created.id, '../x.md', 'x')).rejects.toBeInstanceOf(InvalidNameError)
  })

  test('writeDocument then listDocuments and readDocument round-trip, removeDocument deletes', async () => {
    const created = await store.create(input)
    await store.writeDocument(created.id, 'notes.md', 'hello world')
    const list = await store.listDocuments(created.id)
    expect(list).toEqual([{ name: 'notes.md', chars: 11 }])
    expect(await store.readDocument(created.id, 'notes.md')).toBe('hello world')
    await store.removeDocument(created.id, 'notes.md')
    expect(await store.listDocuments(created.id)).toEqual([])
  })

  test('round-trips the privacy list', async () => {
    const created = await store.create(input)
    expect(await store.readPrivacy(created.id)).toBeNull()
    await store.writePrivacy(created.id, {
      names: [{ value: 'Pierre Séré', kind: 'candidate' }],
      reviewedAt: '2026-08-31T00:00:00.000Z',
    })
    expect((await store.readPrivacy(created.id))?.names).toEqual([{ value: 'Pierre Séré', kind: 'candidate' }])
  })
})
