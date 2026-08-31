export type ProviderId = 'openai' | 'anthropic' | 'gemini'
export type Language = 'fr' | 'en'

export interface Dossier {
  id: string
  company: string
  position: string
  sites: string[]
  language: Language
  provider: ProviderId
  model: string
  createdAt: string
  updatedAt: string
}

export interface Persona {
  name: string
  role: string
  concerns: string
  tone: string
}

export interface Phase {
  id: string
  title: string
  questions: number
  objective: string
  targeting: string[]
  examples: string[]
}

export interface Plan {
  persona: Persona
  phases: Phase[]
}

export interface Requirement {
  index: number
  text: string
  keywords: string[]
  status: 'covered' | 'partial' | 'missing'
  evidence: string
}

export interface Analysis {
  requirements: Requirement[]
  summary: string
}

export interface Message {
  role: 'user' | 'assistant'
  text: string
  sources?: string[]
}

export interface Session {
  id: string
  dossierId: string
  provider: ProviderId
  model: string
  startedAt: string
  messages: Message[]
  debrief: string | null
}

export interface ProviderInfo {
  id: ProviderId
  models: string[]
}

export interface DossierBundle {
  dossier: Dossier
  offer: string
  resume: string
  company: string
  documents: { name: string; chars: number }[]
  analysis: Analysis | null
  plan: Plan | null
}

export const SECTIONS: readonly { id: string; fr: string; en: string }[] = [
  { id: 'sector', fr: 'Secteur', en: 'Sector' },
  { id: 'products', fr: 'Produits et services', en: 'Products and services' },
  { id: 'revenue', fr: "Chiffre d'affaires", en: 'Revenue' },
  { id: 'headcount', fr: 'Effectif', en: 'Headcount' },
  { id: 'sites', fr: 'Sites et établissements', en: 'Sites and locations' },
  { id: 'certifications', fr: 'Certifications', en: 'Certifications' },
  { id: 'news', fr: 'Actualités', en: 'News' },
  { id: 'culture', fr: 'Culture et valeurs', en: 'Culture and values' },
  { id: 'competitors', fr: 'Concurrents', en: 'Competitors' },
]
