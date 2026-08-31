import fs from 'node:fs/promises'
import { Dossier, Session, SessionSchema } from '../domain/types.js'
import { InvalidNameError, NotFoundError } from './errors.js'
import { readJsonFile, writeJsonFile } from './json.js'
import { dossierDir, sessionsDir, sessionPath } from './paths.js'

export class SessionStore {
  constructor(private readonly dataDir: string) {}

  async list(dossierId: string): Promise<Session[]> {
    await this.assertDossierExists(dossierId)
    const dir = sessionsDir(this.dataDir, dossierId)
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      return []
    }
    const sessions = await this.readAll(dossierId, entries)
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  private async readAll(dossierId: string, fileNames: string[]): Promise<Session[]> {
    const sessions: Session[] = []
    for (const fileName of fileNames) {
      const id = fileName.replace(/\.json$/, '')
      const session = await readJsonFile(sessionPath(this.dataDir, dossierId, id), SessionSchema)
      if (session) sessions.push(session)
    }
    return sessions
  }

  private async assertDossierExists(dossierId: string): Promise<void> {
    try {
      await fs.access(dossierDir(this.dataDir, dossierId))
    } catch (error) {
      if (error instanceof InvalidNameError) throw error
      throw new NotFoundError(dossierId)
    }
  }

  async create(dossier: Dossier): Promise<Session> {
    const now = new Date().toISOString()
    const id = await this.uniqueId(dossier.id, now.replace(/[:.]/g, '-'))
    const session: Session = {
      id,
      dossierId: dossier.id,
      provider: dossier.provider,
      model: dossier.model,
      startedAt: now,
      messages: [],
      debrief: null,
    }
    await fs.mkdir(sessionsDir(this.dataDir, dossier.id), { recursive: true })
    await writeJsonFile(sessionPath(this.dataDir, dossier.id, id), session)
    return session
  }

  private async uniqueId(dossierId: string, base: string): Promise<string> {
    let candidate = base
    let n = 2
    while (await this.fileExists(sessionPath(this.dataDir, dossierId, candidate))) {
      candidate = `${base}-${n}`
      n += 1
    }
    return candidate
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async read(dossierId: string, sessionId: string): Promise<Session> {
    const session = await readJsonFile(sessionPath(this.dataDir, dossierId, sessionId), SessionSchema)
    if (!session) throw new NotFoundError(sessionId)
    return session
  }

  async save(session: Session): Promise<void> {
    await writeJsonFile(sessionPath(this.dataDir, session.dossierId, session.id), session)
  }
}
