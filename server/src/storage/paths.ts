import path from 'node:path'
import { InvalidNameError } from './errors.js'

// Slugs are generated as lowercase alphanumerics + dashes (see slugify), but ids may also
// come in as digits/underscore (e.g. session timestamps). Anything else — including `..`
// and path separators — is rejected before it can reach the filesystem.
const ID_RE = /^[\w-]+$/

function assertValidId(id: string): void {
  if (!ID_RE.test(id)) {
    throw new InvalidNameError(id)
  }
}

/**
 * Single choke point for dossier-id path resolution: every path helper in this module
 * that touches a dossier (directly or via sessionsDir/sessionPath) routes through here,
 * so the id is validated before it can ever reach `path.join`/fs calls.
 */
export function dossierDir(dataDir: string, id: string): string {
  assertValidId(id)
  return path.join(dataDir, id)
}

export function dossierJsonPath(dataDir: string, id: string): string {
  return path.join(dossierDir(dataDir, id), 'dossier.json')
}

export function textPath(dataDir: string, id: string, name: 'offer' | 'resume' | 'company'): string {
  return path.join(dossierDir(dataDir, id), `${name}.md`)
}

export function jsonPath(dataDir: string, id: string, name: 'analysis' | 'plan' | 'privacy'): string {
  return path.join(dossierDir(dataDir, id), `${name}.json`)
}

export function documentsDir(dataDir: string, id: string): string {
  return path.join(dossierDir(dataDir, id), 'documents')
}

export function documentPath(dataDir: string, id: string, name: string): string {
  return path.join(documentsDir(dataDir, id), name)
}

export function sessionsDir(dataDir: string, id: string): string {
  return path.join(dossierDir(dataDir, id), 'sessions')
}

export function sessionPath(dataDir: string, dossierId: string, sessionId: string): string {
  assertValidId(sessionId)
  return path.join(sessionsDir(dataDir, dossierId), `${sessionId}.json`)
}
