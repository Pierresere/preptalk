import type { ConfirmedName } from './privacy.js'

const HEADER_LINES = 5
const CONTACT_MARKERS = /(contact|à l'attention|attention|responsable|recruteur|superviseur|directeur|directrice)/gi

// Section headings and calendar words that look like names but never are.
const STOP_WORDS = new Set([
  'formation', 'experience', 'expérience', 'compétences', 'competences', 'profil', 'résumé', 'resume',
  'curriculum', 'vitae', 'objectif', 'langues', 'diplômes', 'diplomes', 'certifications', 'références',
  'references', 'janvier', 'février', 'fevrier', 'mars', 'avril', 'juin', 'juillet', 'aout', 'août',
  'septembre', 'octobre', 'novembre', 'décembre', 'decembre', 'lundi', 'mardi', 'mercredi', 'jeudi',
  'vendredi', 'samedi', 'dimanche',
])

// Both apostrophes: the typewriter U+0027 and the typographic U+2019 ("L’Écuyer").
const WORD = "[A-ZÀ-Ö][\\p{L}'’-]+"
const NAME_RE = new RegExp(`${WORD}(?:\\s+${WORD}){1,3}`, 'gu')

function isName(value: string): boolean {
  const words = value.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return !words.some((w) => STOP_WORDS.has(w.toLowerCase()))
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function isKept(value: string, keep: readonly string[]): boolean {
  return keep.some((k) => fold(k).includes(fold(value)))
}

function candidateFrom(resume: string, keep: readonly string[]): ConfirmedName | null {
  const lines = resume.split('\n').map((l) => l.trim()).filter((l) => l !== '').slice(0, HEADER_LINES)
  for (const line of lines) {
    if (/\d|@/.test(line)) continue
    if (!isName(line) || isKept(line, keep)) continue
    return { value: line, kind: 'candidate' }
  }
  return null
}

function peopleFrom(offer: string, keep: readonly string[]): ConfirmedName[] {
  const found = new Map<string, ConfirmedName>()
  const add = (value: string): void => {
    if (!isName(value) || isKept(value, keep)) return
    found.set(fold(value), { value, kind: 'person' })
  }
  for (const m of offer.matchAll(CONTACT_MARKERS)) {
    const from = (m.index ?? 0) + m[0].length
    for (const n of offer.slice(from, from + 40).matchAll(NAME_RE)) add(n[0])
  }
  const lines = offer.split('\n')
  for (const [i, line] of lines.entries()) {
    if (!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(line)) continue
    const previous = lines[i - 1]?.trim()
    if (previous !== undefined) for (const n of previous.matchAll(NAME_RE)) add(n[0])
  }
  return [...found.values()]
}

export function suggestNames(resume: string, offer: string, keep: readonly string[]): ConfirmedName[] {
  const candidate = candidateFrom(resume, keep)
  return candidate === null ? peopleFrom(offer, keep) : [candidate, ...peopleFrom(offer, keep)]
}
