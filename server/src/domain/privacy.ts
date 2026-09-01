import type { Dossier } from './types.js'

export type NameKind = 'candidate' | 'person'
export type DetectionKind = NameKind | 'email' | 'phone' | 'postal' | 'profile'

export interface ConfirmedName {
  readonly value: string
  readonly kind: NameKind
}

export interface PersonalData {
  readonly names: readonly ConfirmedName[]
  readonly keep: readonly string[]
}

export interface Detection {
  readonly value: string
  readonly kind: DetectionKind
  readonly context: string
}

export interface Masking {
  readonly text: string
  readonly map: ReadonlyMap<string, string>
}

interface Span {
  readonly start: number
  readonly end: number
  readonly kind: DetectionKind
}

const TOKEN_PREFIX: Record<DetectionKind, string> = {
  candidate: 'CANDIDAT',
  person: 'PERSONNE',
  email: 'COURRIEL',
  phone: 'TEL',
  postal: 'CODEPOSTAL',
  profile: 'PROFIL',
}

// Ordered: profiles and emails first, so a name inside them is never split.
const RULES: readonly { kind: DetectionKind; re: RegExp }[] = [
  { kind: 'profile', re: /https?:\/\/(?:[\w-]+\.)*linkedin\.com\/in\/[\w%-]+/gi },
  { kind: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { kind: 'phone', re: /(?:\+?\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}/g },
  { kind: 'phone', re: /\b0\d(?:[ .-]?\d{2}){4}\b/g },
  { kind: 'postal', re: /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/g },
]

const ACCENT_CLASS: Record<string, string> = {
  a: '[aàâä]', c: '[cç]', e: '[eéèêë]', i: '[iîï]', o: '[oôö]', u: '[uùûü]', y: '[yÿ]',
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Builds a case- and accent-insensitive regex that preserves index alignment with the source.
 * The needle is folded first, so "Séré" and "SERE" both compile to the same character classes.
 */
function nameRegex(value: string): RegExp {
  const body = [...fold(value.toLowerCase())]
    .map((ch) => {
      if (/\s/.test(ch)) return '\\s+'
      return ACCENT_CLASS[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return new RegExp(`(?<![\\p{L}\\d-])${body}(?![\\p{L}\\d-])`, 'giu')
}

function keepSpans(text: string, keep: readonly string[]): Span[] {
  const spans: Span[] = []
  for (const value of keep) {
    if (value.trim() === '') continue
    for (const m of text.matchAll(nameRegex(value))) {
      const start = m.index ?? 0
      spans.push({ start, end: start + m[0].length, kind: 'candidate' })
    }
  }
  return spans
}

function overlaps(span: Span, taken: readonly Span[]): boolean {
  return taken.some((t) => span.start < t.end && t.start < span.end)
}

function collect(text: string, personal: PersonalData): Span[] {
  const protectedSpans = keepSpans(text, personal.keep)
  const taken: Span[] = []
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const start = m.index ?? 0
      const span = { start, end: start + m[0].length, kind: rule.kind }
      if (!overlaps(span, taken) && !overlaps(span, protectedSpans)) taken.push(span)
    }
  }
  // Longest names first so "Pierre Séré" wins over "Séré".
  const names = [...personal.names].sort((a, b) => b.value.length - a.value.length)
  for (const name of names) {
    if (name.value.trim() === '') continue
    for (const m of text.matchAll(nameRegex(name.value))) {
      const start = m.index ?? 0
      const span = { start, end: start + m[0].length, kind: name.kind }
      if (!overlaps(span, taken) && !overlaps(span, protectedSpans)) taken.push(span)
    }
  }
  return taken.sort((a, b) => a.start - b.start)
}

const CONTEXT_RADIUS = 40

export function detect(text: string, personal: PersonalData): Detection[] {
  return collect(text, personal).map((span) => ({
    value: text.slice(span.start, span.end),
    kind: span.kind,
    context: text.slice(Math.max(0, span.start - CONTEXT_RADIUS), span.end + CONTEXT_RADIUS),
  }))
}

export function mask(text: string, personal: PersonalData): Masking {
  const spans = collect(text, personal)
  const map = new Map<string, string>()
  const tokenFor = new Map<string, string>()
  const counters = new Map<DetectionKind, number>()
  const parts: string[] = []
  let cursor = 0
  for (const span of spans) {
    const value = text.slice(span.start, span.end)
    const key = `${span.kind}:${value}`
    let token = tokenFor.get(key)
    if (token === undefined) {
      const next = (counters.get(span.kind) ?? 0) + 1
      counters.set(span.kind, next)
      token = `[${TOKEN_PREFIX[span.kind]}_${next}]`
      tokenFor.set(key, token)
      map.set(token, value)
    }
    parts.push(text.slice(cursor, span.start), token)
    cursor = span.end
  }
  parts.push(text.slice(cursor))
  return { text: parts.join(''), map }
}

export function unmask(text: string, map: ReadonlyMap<string, string>): string {
  let out = text
  for (const [token, value] of map) out = out.split(token).join(value)
  return out
}

export function personalDataOf(dossier: Dossier, confirmed: readonly ConfirmedName[]): PersonalData {
  return { names: confirmed, keep: [dossier.company, dossier.position] }
}
