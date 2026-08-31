import type {
  Analysis,
  Dossier,
  DossierBundle,
  Language,
  Plan,
  ProviderId,
  ProviderInfo,
  Session,
} from '../types.js'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function extractErrorMessage(body: unknown): string {
  if (body !== null && typeof body === 'object' && 'error' in body) {
    const error = (body as { error: unknown }).error
    return typeof error === 'string' ? error : JSON.stringify(error)
  }
  return 'Unknown error'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new ApiError(extractErrorMessage(body), res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export interface CreateDossierInput {
  company: string
  position: string
  sites: string[]
  language: Language
  provider: ProviderId
  model: string
}

export function getProviders(): Promise<ProviderInfo[]> {
  return request('/api/providers')
}

export function listDossiers(): Promise<Dossier[]> {
  return request('/api/dossiers')
}

export function createDossier(input: CreateDossierInput): Promise<Dossier> {
  return request('/api/dossiers', json('POST', input))
}

export function getDossier(id: string): Promise<DossierBundle> {
  return request(`/api/dossiers/${id}`)
}

export function deleteDossier(id: string): Promise<void> {
  return request(`/api/dossiers/${id}`, { method: 'DELETE' })
}

export function putText(id: string, name: 'offer' | 'resume' | 'company', text: string): Promise<void> {
  return request(`/api/dossiers/${id}/${name}`, json('PUT', { text }))
}

export function putPlan(id: string, plan: Plan): Promise<void> {
  return request(`/api/dossiers/${id}/plan`, json('PUT', plan))
}

export function addDocument(id: string, name: string, text: string): Promise<void> {
  return request(`/api/dossiers/${id}/documents`, json('POST', { name, text }))
}

export function removeDocument(id: string, name: string): Promise<void> {
  return request(`/api/dossiers/${id}/documents/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function researchCompany(id: string): Promise<{ company: string }> {
  return request(`/api/dossiers/${id}/company/research`, { method: 'POST' })
}

export function researchSection(id: string, section: string): Promise<{ company: string }> {
  return request(`/api/dossiers/${id}/company/research/${section}`, { method: 'POST' })
}

export function runAnalysis(id: string): Promise<Analysis> {
  return request(`/api/dossiers/${id}/analysis`, { method: 'POST' })
}

export function generatePlan(id: string): Promise<Plan> {
  return request(`/api/dossiers/${id}/plan`, { method: 'POST' })
}

export function listSessions(id: string): Promise<Session[]> {
  return request(`/api/dossiers/${id}/sessions`)
}

export function createSession(id: string): Promise<Session> {
  return request(`/api/dossiers/${id}/sessions`, { method: 'POST' })
}

export async function sendTurn(id: string, sid: string, text: string, signal: AbortSignal): Promise<Response> {
  const res = await fetch(`/api/dossiers/${id}/sessions/${sid}/turn`, {
    ...json('POST', { text }),
    signal,
  })
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new ApiError(extractErrorMessage(body), res.status)
  }
  return res
}
