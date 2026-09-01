import type { Analysis } from '../domain/types.js'
import type { Chunk } from '../domain/retrieval.js'
import { SECTION_TITLES } from '../domain/sections.js'
import { parseCompany } from './research.js'

export interface BuildChunksInput {
  readonly offer: string
  readonly resume: string
  readonly company: string
  readonly documents: readonly { name: string; text: string }[]
  readonly analysis: Analysis | null
}

function textChunk(id: string, title: string, kind: Chunk['kind'], body: string): Chunk | null {
  if (body.trim().length === 0) return null
  return { id, title, kind, body }
}

function companyChunks(company: string): Chunk[] {
  const sections = parseCompany(company)
  const chunks: Chunk[] = []
  for (const [id, body] of sections) {
    const chunk = textChunk(`company/${id}`, SECTION_TITLES[id].en, 'company', body)
    if (chunk) chunks.push(chunk)
  }
  return chunks
}

function documentChunks(documents: readonly { name: string; text: string }[]): Chunk[] {
  const chunks: Chunk[] = []
  for (const doc of documents) {
    const chunk = textChunk(`document/${doc.name}`, doc.name, 'document', doc.text)
    if (chunk) chunks.push(chunk)
  }
  return chunks
}

function requirementChunks(analysis: Analysis | null): Chunk[] {
  if (!analysis) return []
  const chunks: Chunk[] = []
  for (const requirement of analysis.requirements) {
    const body = `${requirement.text}\n${requirement.evidence}`
    const title = `Requirement ${requirement.index} (${requirement.status})`
    const chunk = textChunk(`requirement/${requirement.index}`, title, 'requirement', body)
    if (chunk) chunks.push(chunk)
  }
  return chunks
}

export function buildChunks(input: BuildChunksInput): Chunk[] {
  const chunks: Chunk[] = []
  const offer = textChunk('offer', 'Job offer', 'offer', input.offer)
  if (offer) chunks.push(offer)
  const resume = textChunk('resume', 'Resume', 'resume', input.resume)
  if (resume) chunks.push(resume)
  chunks.push(...companyChunks(input.company))
  chunks.push(...documentChunks(input.documents))
  chunks.push(...requirementChunks(input.analysis))
  return chunks
}
