export type ChunkKind = 'offer' | 'resume' | 'company' | 'document' | 'requirement'

export interface Chunk {
  readonly id: string
  readonly title: string
  readonly kind: ChunkKind
  readonly body: string
}

export interface ChunkHit {
  readonly chunk: Chunk
  readonly score: number
  readonly reasons: readonly string[]
}

const STOP_WORDS = new Set([
  'le','la','les','de','des','du','un','une','et','ou','que','qui','est','sont','pour','dans',
  'sur','avec','par','ce','cette','ces','comment','pourquoi','quand','il','on','je','nous',
  'vous','au','aux','en','plus','moins','entre','selon','doit','peut','mon','ma','mes','son',
  'the','and','for','with','that','this','from','are','was','you','your','our','what','how',
  'why','when','have','has','not','but','they','them','their','into','about',
])

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter((t) => t.length > 2 && !STOP_WORDS.has(t))
}

function countIn(tokens: readonly string[], haystack: string): number {
  return tokens.filter((t) => haystack.includes(t)).length
}

const MAX_CONTEXT_CHARS = 60_000

function scoreChunk(chunk: Chunk, tokens: readonly string[]): ChunkHit {
  const reasons: string[] = []
  let score = 0
  const inTitle = countIn(tokens, normalize(chunk.title))
  if (inTitle > 0) { score += inTitle * 20; reasons.push(`${inTitle} in title`) }
  const inBody = countIn(tokens, normalize(chunk.body))
  if (inBody > 0) { score += inBody * 3; reasons.push(`${inBody} in body`) }
  return { chunk, score, reasons }
}

export function selectChunks(chunks: readonly Chunk[], query: string, limit = 6): ChunkHit[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []
  const ranked = chunks.map((c) => scoreChunk(c, tokens)).sort((a, b) => b.score - a.score)
  const best = ranked[0]?.score ?? 0
  const floor = Math.max(6, best * 0.3)
  const kept: ChunkHit[] = []
  let budget = MAX_CONTEXT_CHARS
  for (const hit of ranked) {
    if (kept.length >= limit || hit.score < floor) break
    if (hit.chunk.body.length > budget && kept.length > 0) continue
    kept.push(hit)
    budget -= hit.chunk.body.length
  }
  return kept
}
