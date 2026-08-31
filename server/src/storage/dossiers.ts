import fs from 'node:fs/promises'
import { z } from 'zod'
import { Dossier, DossierSchema } from '../domain/types.js'
import { NotFoundError, InvalidNameError } from './errors.js'
import { readJsonFile } from './json.js'
import {
  dossierDir,
  dossierJsonPath,
  textPath,
  jsonPath,
  documentsDir,
  documentPath,
  sessionsDir,
} from './paths.js'

const DOCUMENT_NAME_RE = /^[\w.-]+\.(md|txt)$/

export function slugify(name: string): string {
  const folded = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  const slug = folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug === '' ? 'dossier' : slug
}

type CreateInput = {
  company: string
  position: string
  sites: string[]
  language: Dossier['language']
  provider: Dossier['provider']
  model: string
}

function validateDocumentName(name: string): void {
  if (name.includes('..') || !DOCUMENT_NAME_RE.test(name)) {
    throw new InvalidNameError(name)
  }
}

export class DossierStore {
  constructor(private readonly dataDir: string) {}

  async list(): Promise<Dossier[]> {
    await fs.mkdir(this.dataDir, { recursive: true })
    const entries = await fs.readdir(this.dataDir, { withFileTypes: true })
    const dossiers: Dossier[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dossier = await readJsonFile(dossierJsonPath(this.dataDir, entry.name), DossierSchema)
      if (dossier) dossiers.push(dossier)
    }
    return dossiers
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base
    let n = 2
    while (await this.exists(candidate)) {
      candidate = `${base}-${n}`
      n += 1
    }
    return candidate
  }

  private async exists(id: string): Promise<boolean> {
    try {
      await fs.access(dossierDir(this.dataDir, id))
      return true
    } catch {
      return false
    }
  }

  async create(input: CreateInput): Promise<Dossier> {
    const id = await this.uniqueSlug(slugify(input.company))
    const now = new Date().toISOString()
    const dossier: Dossier = { ...input, id, createdAt: now, updatedAt: now }
    await fs.mkdir(dossierDir(this.dataDir, id), { recursive: true })
    await fs.mkdir(documentsDir(this.dataDir, id), { recursive: true })
    await fs.mkdir(sessionsDir(this.dataDir, id), { recursive: true })
    await fs.writeFile(dossierJsonPath(this.dataDir, id), JSON.stringify(dossier, null, 2), 'utf-8')
    await fs.writeFile(textPath(this.dataDir, id, 'offer'), '', 'utf-8')
    await fs.writeFile(textPath(this.dataDir, id, 'resume'), '', 'utf-8')
    await fs.writeFile(textPath(this.dataDir, id, 'company'), '', 'utf-8')
    return dossier
  }

  async read(id: string): Promise<Dossier> {
    const dossier = await readJsonFile(dossierJsonPath(this.dataDir, id), DossierSchema)
    if (!dossier) throw new NotFoundError(id)
    return dossier
  }

  async update(id: string, patch: Partial<Dossier>): Promise<Dossier> {
    const current = await this.read(id)
    const updated: Dossier = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    }
    await fs.writeFile(dossierJsonPath(this.dataDir, id), JSON.stringify(updated, null, 2), 'utf-8')
    return updated
  }

  async remove(id: string): Promise<void> {
    await fs.rm(dossierDir(this.dataDir, id), { recursive: true, force: true })
  }

  async readText(id: string, name: 'offer' | 'resume' | 'company'): Promise<string> {
    try {
      return await fs.readFile(textPath(this.dataDir, id, name), 'utf-8')
    } catch {
      return ''
    }
  }

  async writeText(id: string, name: 'offer' | 'resume' | 'company', text: string): Promise<void> {
    await fs.writeFile(textPath(this.dataDir, id, name), text, 'utf-8')
  }

  async readJson<T>(id: string, name: 'analysis' | 'plan', schema: z.ZodType<T>): Promise<T | null> {
    return readJsonFile(jsonPath(this.dataDir, id, name), schema)
  }

  async writeJson<T>(id: string, name: 'analysis' | 'plan', value: T): Promise<void> {
    await fs.writeFile(jsonPath(this.dataDir, id, name), JSON.stringify(value, null, 2), 'utf-8')
  }

  async listDocuments(id: string): Promise<{ name: string; chars: number }[]> {
    const dir = documentsDir(this.dataDir, id)
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return []
    }
    const documents = await Promise.all(
      entries.map(async (name) => {
        const content = await fs.readFile(documentPath(this.dataDir, id, name), 'utf-8')
        return { name, chars: content.length }
      })
    )
    return documents
  }

  async readDocument(id: string, name: string): Promise<string> {
    validateDocumentName(name)
    return fs.readFile(documentPath(this.dataDir, id, name), 'utf-8')
  }

  async writeDocument(id: string, name: string, text: string): Promise<void> {
    validateDocumentName(name)
    await fs.mkdir(documentsDir(this.dataDir, id), { recursive: true })
    await fs.writeFile(documentPath(this.dataDir, id, name), text, 'utf-8')
  }

  async removeDocument(id: string, name: string): Promise<void> {
    validateDocumentName(name)
    await fs.rm(documentPath(this.dataDir, id, name), { force: true })
  }
}
