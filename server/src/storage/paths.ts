import path from 'node:path'

export function dossierDir(dataDir: string, id: string): string {
  return path.join(dataDir, id)
}

export function dossierJsonPath(dataDir: string, id: string): string {
  return path.join(dossierDir(dataDir, id), 'dossier.json')
}

export function textPath(dataDir: string, id: string, name: 'offer' | 'resume' | 'company'): string {
  return path.join(dossierDir(dataDir, id), `${name}.md`)
}

export function jsonPath(dataDir: string, id: string, name: 'analysis' | 'plan'): string {
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
  return path.join(sessionsDir(dataDir, dossierId), `${sessionId}.json`)
}
