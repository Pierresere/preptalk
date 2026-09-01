# Pseudonymisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No personal data ever crosses the `Provider` boundary, and the user can see and correct what gets masked.

**Architecture:** A pure masking module (`domain/privacy.ts`) turns personal values into tokens and back. A decorator (`providers/masked.ts`) wraps every real provider in `registry.ts`, masking `stream`/`structured` payloads on the way out and rehydrating on the way back; `search` passes through but is guarded. A required `personal` field on the provider inputs makes the protection impossible to forget — a pipeline that omits it does not compile. The confirmed name list lives in `data/<dossier>/privacy.json`; the token map is per-call and never persisted.

**Tech Stack:** TypeScript strict (no `any`), Node 22, Hono, zod, vitest, React 18.

**Spec:** [`docs/superpowers/specs/2026-08-31-pseudonymisation-design.md`](../specs/2026-08-31-pseudonymisation-design.md)

## Global Constraints

- TypeScript strict; **never `any`** — use `unknown` and narrow.
- Size limits: React component ≤ 200 LOC, hook ≤ 150 LOC, service/utility ≤ 300 LOC, function ≤ 40 LOC.
- No `console.log`, no unjustified `TODO`.
- Code and comments in English; user-facing copy goes through `web/src/i18n/{fr,en}.json` (both files must keep identical key sets — a test enforces it).
- Update `FILEMAP.md` in the same commit whenever a file is created.
- Run `npm run typecheck --workspaces` and `npm run test --workspaces` before every commit.
- **Refinement over the spec:** `PersonalData.names` carries `{ value, kind }` rather than bare strings, so the candidate and third parties get distinct token prefixes (`[CANDIDAT_n]` vs `[PERSONNE_n]`). `PersonalData` lives in `domain/privacy.ts` and is imported by `providers/types.ts`, keeping the existing dependency direction (providers depend on domain, never the reverse).

---

### Task 1: The masking module

**Files:**
- Create: `server/src/domain/privacy.ts`
- Test: `server/test/domain/privacy.test.ts`
- Modify: `FILEMAP.md`

**Interfaces:**
- Consumes: `Dossier` from `server/src/domain/types.js`
- Produces:
  - `type NameKind = 'candidate' | 'person'`
  - `interface ConfirmedName { readonly value: string; readonly kind: NameKind }`
  - `interface PersonalData { readonly names: readonly ConfirmedName[]; readonly keep: readonly string[] }`
  - `interface Detection { readonly value: string; readonly kind: DetectionKind; readonly context: string }`
  - `interface Masking { readonly text: string; readonly map: ReadonlyMap<string, string> }`
  - `detect(text: string, personal: PersonalData): Detection[]`
  - `mask(text: string, personal: PersonalData): Masking`
  - `unmask(text: string, map: ReadonlyMap<string, string>): string`
  - `personalDataOf(dossier: Dossier, confirmed: readonly ConfirmedName[]): PersonalData`

- [ ] **Step 1: Write the failing test**

Create `server/test/domain/privacy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { detect, mask, unmask, personalDataOf } from '../../src/domain/privacy.js'
import type { ConfirmedName, PersonalData } from '../../src/domain/privacy.js'
import type { Dossier } from '../../src/domain/types.js'

const NAMES: ConfirmedName[] = [
  { value: 'Pierre Séré', kind: 'candidate' },
  { value: 'Séré', kind: 'candidate' },
  { value: 'Marie Tremblay', kind: 'person' },
]
const personal: PersonalData = { names: NAMES, keep: ['Câbles Ben-Mor', 'Coordonnateur qualité'] }

describe('mask', () => {
  it('masks emails, phones, postal codes and LinkedIn profiles', () => {
    const text = [
      'pierre.sere@example.com',
      '514-555-0123',
      '06 12 34 56 78',
      'H2X 1Y4',
      'https://www.linkedin.com/in/pierre-sere',
    ].join('\n')
    const out = mask(text, personal)
    expect(out.text).toBe('[COURRIEL_1]\n[TEL_1]\n[TEL_2]\n[CODEPOSTAL_1]\n[PROFIL_1]')
    expect(unmask(out.text, out.map)).toBe(text)
  })

  it('masks names case- and accent-insensitively with distinct tokens per value', () => {
    const out = mask('PIERRE SERE a écrit. Sere a signé. Marie Tremblay recrute.', personal)
    expect(out.text).toBe('[CANDIDAT_1] a écrit. [CANDIDAT_2] a signé. [PERSONNE_1] recrute.')
    expect(out.map.get('[CANDIDAT_1]')).toBe('PIERRE SERE')
    expect(out.map.get('[CANDIDAT_2]')).toBe('Sere')
  })

  it('never masks a name inside a keep span', () => {
    const out = mask('Câbles Ben-Mor cherche. Séré postule.', {
      names: [{ value: 'Ben-Mor', kind: 'candidate' }, { value: 'Séré', kind: 'candidate' }],
      keep: ['Câbles Ben-Mor'],
    })
    expect(out.text).toBe('Câbles Ben-Mor cherche. [CANDIDAT_1] postule.')
  })

  it('masks an email before the name it contains', () => {
    const out = mask('Écrire à pierre.sere@example.com pour joindre Pierre Séré.', personal)
    expect(out.text).toBe('Écrire à [COURRIEL_1] pour joindre [CANDIDAT_1].')
  })

  it('is idempotent on already-masked text', () => {
    const once = mask('Pierre Séré', personal)
    expect(mask(once.text, personal).text).toBe(once.text)
  })

  it('leaves text without personal data untouched', () => {
    const out = mask('Coordonnateur qualité chez Câbles Ben-Mor.', personal)
    expect(out.text).toBe('Coordonnateur qualité chez Câbles Ben-Mor.')
    expect(out.map.size).toBe(0)
  })
})

describe('detect', () => {
  it('reports the same values mask replaces, with context', () => {
    const text = 'Contact : Marie Tremblay, marie@example.com'
    const found = detect(text, personal)
    expect(found.map((d) => d.kind).sort()).toEqual(['email', 'person'])
    expect(found.every((d) => text.includes(d.value))).toBe(true)
    expect(found.every((d) => d.context.includes(d.value))).toBe(true)
  })
})

describe('personalDataOf', () => {
  it('keeps the company and position spans', () => {
    const dossier = {
      id: 'ben-mor', company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité',
      sites: [], language: 'fr', provider: 'gemini', model: 'm',
      createdAt: '', updatedAt: '',
    } as Dossier
    expect(personalDataOf(dossier, NAMES)).toEqual({ names: NAMES, keep: ['Câbles Ben-Mor', 'Coordonnateur qualité'] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=server -- privacy`
Expected: FAIL — `Failed to resolve import "../../src/domain/privacy.js"`.

- [ ] **Step 3: Write the implementation**

Create `server/src/domain/privacy.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=server -- privacy`
Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck --workspace=server`
Expected: no output.

- [ ] **Step 6: Update FILEMAP.md**

Add after the `server/src/domain/prompt.ts` line:

```markdown
- `server/src/domain/privacy.ts` — pure pseudonymisation core: `ConfirmedName`/`PersonalData`/`Detection`/`Masking` types, ordered detection rules (LinkedIn profile, email, phone NA+FR, Canadian postal code) then confirmed names via accent- and case-insensitive `nameRegex`, `keep` spans never masked; `detect` (for the review screen), `mask` (one `[PREFIX_n]` token per distinct value), `unmask`, `personalDataOf(dossier, confirmed)`
```

- [ ] **Step 7: Commit**

```bash
git add server/src/domain/privacy.ts server/test/domain/privacy.test.ts FILEMAP.md
git commit -m "feat(server): pseudonymisation masking core"
```

---

### Task 2: Name suggestion

**Files:**
- Create: `server/src/domain/suggest.ts`
- Test: `server/test/domain/suggest.test.ts`
- Modify: `FILEMAP.md`

**Interfaces:**
- Consumes: `ConfirmedName`, `PersonalData` from `server/src/domain/privacy.js`
- Produces: `suggestNames(resume: string, offer: string, keep: readonly string[]): ConfirmedName[]`

Kept in its own file rather than inside `privacy.ts`: heuristics change often, masking rules must not, and the 300-LOC utility limit applies to both.

- [ ] **Step 1: Write the failing test**

Create `server/test/domain/suggest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { suggestNames } from '../../src/domain/suggest.js'

const RESUME = `Pierre Séré
Coordonnateur qualité
pierre.sere@example.com · 514-555-0123

Expérience
Câbles Ben-Mor — Saint-Hyacinthe`

describe('suggestNames', () => {
  it('takes the candidate name from the resume header', () => {
    expect(suggestNames(RESUME, '', ['Câbles Ben-Mor'])).toContainEqual({ value: 'Pierre Séré', kind: 'candidate' })
  })

  it('skips a leading blank line and a section heading', () => {
    expect(suggestNames('\n\nMarie Tremblay\nFormation\n', '', [])).toContainEqual({
      value: 'Marie Tremblay', kind: 'candidate',
    })
  })

  it('never suggests a keep span', () => {
    const found = suggestNames('Câbles Ben-Mor\nmarie@example.com', '', ['Câbles Ben-Mor'])
    expect(found.some((n) => n.value === 'Câbles Ben-Mor')).toBe(false)
  })

  it('suggests a third party after a contact marker', () => {
    const offer = 'Postulez. Contact : Marie Tremblay, responsable RH.'
    expect(suggestNames('', offer, [])).toContainEqual({ value: 'Marie Tremblay', kind: 'person' })
  })

  it('suggests the name on the line above an email in an offer', () => {
    const offer = 'Notre équipe\nJean Gagnon\njean.gagnon@example.com'
    expect(suggestNames('', offer, [])).toContainEqual({ value: 'Jean Gagnon', kind: 'person' })
  })

  it('returns nothing for a resume without a name-shaped header', () => {
    expect(suggestNames('CURRICULUM VITAE 2026\n\nExpérience', '', [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=server -- suggest`
Expected: FAIL — cannot resolve `../../src/domain/suggest.js`.

- [ ] **Step 3: Write the implementation**

Create `server/src/domain/suggest.ts`:

```ts
import type { ConfirmedName } from './privacy.js'

const HEADER_LINES = 5
const CONTACT_MARKERS = /(contact|à l'attention|attention|responsable|recruteur|superviseur|directeur|directrice)/i

// Section headings and calendar words that look like names but never are.
const STOP_WORDS = new Set([
  'formation', 'experience', 'expérience', 'compétences', 'competences', 'profil', 'résumé', 'resume',
  'curriculum', 'vitae', 'objectif', 'langues', 'diplômes', 'diplomes', 'certifications', 'références',
  'references', 'janvier', 'février', 'fevrier', 'mars', 'avril', 'juin', 'juillet', 'aout', 'août',
  'septembre', 'octobre', 'novembre', 'décembre', 'decembre', 'lundi', 'mardi', 'mercredi', 'jeudi',
  'vendredi', 'samedi', 'dimanche',
])

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=server -- suggest`
Expected: PASS, 6 tests.

- [ ] **Step 5: Typecheck, then update FILEMAP.md**

Run: `npm run typecheck --workspace=server`

Add after the `server/src/domain/privacy.ts` line:

```markdown
- `server/src/domain/suggest.ts` — `suggestNames(resume, offer, keep)`: local, AI-free heuristics feeding the review screen — candidate from the first 5 resume header lines (2-4 capitalised words, no digit or `@`, not a stop word, not a `keep` span), third parties from 2-4 capitalised words within 40 characters after a contact marker or on the line above an email
```

- [ ] **Step 6: Commit**

```bash
git add server/src/domain/suggest.ts server/test/domain/suggest.test.ts FILEMAP.md
git commit -m "feat(server): local name suggestion for the masking review"
```

---

### Task 3: The masking decorator and the required `personal` field

This task must be atomic: making `personal` required breaks compilation at every call site, so the decorator, the interface change and all call sites land in one green commit.

**Files:**
- Create: `server/src/providers/masked.ts`, `server/test/providers/masked.test.ts`
- Modify: `server/src/providers/types.ts`, `server/src/providers/registry.ts`, `server/src/pipeline/analysis.ts`, `server/src/pipeline/plan.ts`, `server/src/pipeline/interview.ts`, `server/src/routes/prepare.ts`, `server/test/pipeline/analysis.test.ts`, `server/test/pipeline/interview.test.ts`, `FILEMAP.md`

**Interfaces:**
- Consumes: `mask`, `unmask`, `personalDataOf`, `PersonalData` from `server/src/domain/privacy.js`
- Produces:
  - `StreamInput.personal: PersonalData` and `StructuredInput.personal: PersonalData` (required)
  - `withMasking(provider: Provider): Provider`
  - `AnalyzeInput.personal: PersonalData`, `GeneratePlanInput.personal: PersonalData`

- [ ] **Step 1: Write the failing test**

Create `server/test/providers/masked.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { withMasking } from '../../src/providers/masked.js'
import { FakeProvider } from '../../src/providers/fake.js'
import { ProviderError } from '../../src/providers/types.js'
import type { PersonalData } from '../../src/domain/privacy.js'

const personal: PersonalData = {
  names: [{ value: 'Pierre Séré', kind: 'candidate' }],
  keep: ['Câbles Ben-Mor'],
}
const base = { model: 'fake', signal: new AbortController().signal }

describe('withMasking', () => {
  it('masks the outgoing prompt and rehydrates the streamed answer', async () => {
    const fake = new FakeProvider({ stream: 'Bonjour [CANDIDAT_1] chez Câbles Ben-Mor' })
    const out: string[] = []
    for await (const chunk of withMasking(fake).stream({
      ...base, temperature: 0.5, personal,
      system: 'Tu parles à Pierre Séré.',
      messages: [{ role: 'user', text: 'Je suis Pierre Séré.' }],
    })) out.push(chunk)
    const sent = JSON.stringify(fake.calls[0]?.input)
    expect(sent).not.toContain('Pierre Séré')
    expect(sent).toContain('[CANDIDAT_1]')
    expect(out.join('')).toBe('Bonjour Pierre Séré chez Câbles Ben-Mor')
  })

  it('rehydrates a token split across chunks', async () => {
    const fake = new FakeProvider({ stream: '[CANDIDAT_1] arrive' })
    const out: string[] = []
    for await (const chunk of withMasking(fake).stream({
      ...base, temperature: 0.5, personal, system: 'Pierre Séré', messages: [],
    })) out.push(chunk)
    expect(out.join('')).toBe('Pierre Séré arrive')
    expect(out.length).toBeGreaterThan(1)
  })

  it('emits an unclosed bracket run as plain text', async () => {
    const long = `[${'x'.repeat(40)}`
    const fake = new FakeProvider({ stream: long })
    const out: string[] = []
    for await (const chunk of withMasking(fake).stream({
      ...base, temperature: 0.5, personal, system: 'Pierre Séré', messages: [],
    })) out.push(chunk)
    expect(out.join('')).toBe(long)
  })

  it('rehydrates strings nested in a structured result', async () => {
    const schema = z.object({ items: z.array(z.object({ note: z.string() })) })
    const fake = new FakeProvider({ structured: { items: [{ note: 'vu chez [CANDIDAT_1]' }] } })
    const result = await withMasking(fake).structured({
      ...base, personal, schema, system: 'sys', prompt: 'Pierre Séré',
    })
    expect(result.items[0]?.note).toBe('vu chez Pierre Séré')
    expect(JSON.stringify(fake.calls[0]?.input)).not.toContain('Pierre Séré')
  })

  it('passes a clean search query through untouched', async () => {
    const fake = new FakeProvider({ search: { text: 'ok', sources: [] } })
    const result = await withMasking(fake).search({ ...base, query: 'Câbles Ben-Mor secteur' })
    expect(result.text).toBe('ok')
  })

  it('rejects a search query carrying personal data, without echoing it', async () => {
    const fake = new FakeProvider({ search: { text: 'ok', sources: [] } })
    const call = withMasking(fake).search({ ...base, query: 'écrire à pierre.sere@example.com' })
    await expect(call).rejects.toBeInstanceOf(ProviderError)
    await expect(call).rejects.toThrow(/^Personal data in search query$/)
    expect(fake.calls).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=server -- masked`
Expected: FAIL — cannot resolve `../../src/providers/masked.js`.

- [ ] **Step 3: Add `personal` to the provider inputs**

In `server/src/providers/types.ts`, add the import and the two fields:

```ts
import type { PersonalData } from '../domain/privacy.js'
```

Inside `StreamInput`, after `messages`:

```ts
  readonly personal: PersonalData
```

Inside `StructuredInput<T>`, after `prompt`:

```ts
  readonly personal: PersonalData
```

- [ ] **Step 4: Write the decorator**

Create `server/src/providers/masked.ts`:

```ts
import { mask, unmask } from '../domain/privacy.js'
import type { PersonalData } from '../domain/privacy.js'
import { ProviderError } from './types.js'
import type { Provider, SearchInput, SearchResult, StreamInput, StructuredInput } from './types.js'

const MAX_TOKEN_LENGTH = 32
const NO_NAMES: PersonalData = { names: [], keep: [] }

/**
 * Rehydrates a stream, holding back only a trailing *incomplete* token.
 * A token that already carries its closing bracket is emitted immediately, so the
 * chat keeps streaming instead of stalling until the next 32 characters arrive.
 */
async function* rehydrate(
  source: AsyncIterable<string>,
  map: ReadonlyMap<string, string>
): AsyncIterable<string> {
  let buffer = ''
  for await (const chunk of source) {
    buffer += chunk
    const open = buffer.lastIndexOf('[')
    const closed = open !== -1 && buffer.indexOf(']', open) !== -1
    const runaway = open !== -1 && buffer.length - open > MAX_TOKEN_LENGTH
    const safe = open === -1 || closed || runaway ? buffer.length : open
    if (safe > 0) yield unmask(buffer.slice(0, safe), map)
    buffer = buffer.slice(safe)
  }
  if (buffer !== '') yield unmask(buffer, map)
}

function rehydrateDeep(value: unknown, map: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') return unmask(value, map)
  if (Array.isArray(value)) return value.map((item) => rehydrateDeep(item, map))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rehydrateDeep(item, map)])
    )
  }
  return value
}

function assertClean(query: string, personal: PersonalData): void {
  // A query is built from company/position/sites only; anything else is a bug, not a user error.
  if (mask(query, personal).map.size > 0) {
    throw new ProviderError('Personal data in search query', 500)
  }
}

export function withMasking(provider: Provider): Provider {
  return {
    id: provider.id,
    models: provider.models,

    stream(input: StreamInput): AsyncIterable<string> {
      const system = mask(input.system, input.personal)
      const map = new Map(system.map)
      const messages = input.messages.map((message) => {
        const masked = mask(message.text, input.personal)
        for (const [token, value] of masked.map) map.set(token, value)
        return { role: message.role, text: masked.text }
      })
      // `personal` is replaced, not forwarded: the confirmed names are themselves personal data
      // and have no business sitting in the object handed to the real provider.
      return rehydrate(
        provider.stream({ ...input, system: system.text, messages, personal: NO_NAMES }),
        map
      )
    },

    async structured<T>(input: StructuredInput<T>): Promise<T> {
      const system = mask(input.system, input.personal)
      const prompt = mask(input.prompt, input.personal)
      const map = new Map([...system.map, ...prompt.map])
      const result = await provider.structured({
        ...input,
        system: system.text,
        prompt: prompt.text,
        personal: NO_NAMES,
      })
      return rehydrateDeep(result, map) as T
    },

    async search(input: SearchInput): Promise<SearchResult> {
      assertClean(input.query, NO_NAMES)
      return provider.search(input)
    },
  }
}
```

Note on the single cast: `rehydrateDeep` walks `unknown` and rebuilds the same shape, replacing strings only, so the result is structurally identical to `T`. TypeScript cannot express that, hence one documented cast rather than `any`.

The `search` guard uses `NO_NAMES` because confirmed names are not available on `SearchInput`; the regex rules are what matter there — a query with an email or phone number is a programming error.

- [ ] **Step 5: Wrap the providers in the registry**

In `server/src/providers/registry.ts`, import the decorator and wrap each provider:

```ts
import { withMasking } from './masked.js'
```

```ts
  if (config.keys.anthropic !== undefined) map.set('anthropic', withMasking(createAnthropicProvider(config.keys.anthropic)))
  if (config.keys.openai !== undefined) map.set('openai', withMasking(createOpenAiProvider(config.keys.openai)))
  if (config.keys.gemini !== undefined) map.set('gemini', withMasking(createGeminiProvider(config.keys.gemini)))
```

- [ ] **Step 6: Thread `personal` through the pipelines**

In `server/src/pipeline/analysis.ts`, add to the imports and to `AnalyzeInput`:

```ts
import type { PersonalData } from '../domain/privacy.js'
```

```ts
  readonly personal: PersonalData
```

Then destructure it and pass it to `provider.structured({ ..., personal })`.

Apply the same three edits to `server/src/pipeline/plan.ts` (`GeneratePlanInput`, destructuring, `provider.structured`).

In `server/src/pipeline/interview.ts`, import `personalDataOf` and pass it to the stream call:

```ts
import { personalDataOf } from '../domain/privacy.js'
```

```ts
  const messages = /* existing */
  const stream = provider.stream({
    system,
    messages,
    personal: personalDataOf(dossier, []),
    model: dossier.model,
    temperature: 0.85,
    signal: input.signal,
  })
```

The empty confirmed list is temporary — Task 4 replaces it with the stored list. Regex-based masking is already active here.

In `server/src/routes/prepare.ts`, pass `personal: personalDataOf(dossier, [])` to both the `analyze(...)` and `generatePlan(...)` calls.

- [ ] **Step 7: Fix the existing server tests**

`server/test/pipeline/analysis.test.ts` and `server/test/pipeline/interview.test.ts` construct pipeline inputs directly. Add `personal: { names: [], keep: [] }` to every `analyze(...)` call and to any direct `provider.structured`/`provider.stream` call in those files.

- [ ] **Step 8: Run the full server suite**

Run: `npm run typecheck --workspace=server`
Then: `npm run test --workspace=server`
Expected: PASS — the new `masked` tests plus every pre-existing test.

- [ ] **Step 9: Update FILEMAP.md**

Add after the `server/src/providers/registry.ts` line:

```markdown
- `server/src/providers/masked.ts` — `withMasking(provider)`: decorator applied to every provider in `registry.ts`; masks `system`/`messages` before `stream` and `system`/`prompt` before `structured`, rehydrates the stream through a 32-character buffer that holds back a partial `[TOKEN]` across chunks, rehydrates structured results by walking `unknown` recursively, and guards `search` with `ProviderError('Personal data in search query', 500)` without echoing the query
```

Also update the `server/src/providers/types.ts`, `server/src/pipeline/analysis.ts`, `server/src/pipeline/plan.ts` and `server/src/pipeline/interview.ts` lines to mention the required `personal` field.

- [ ] **Step 10: Commit**

```bash
git add server/src server/test FILEMAP.md
git commit -m "feat(server): mask personal data at the provider boundary"
```

---

### Task 4: Persisting the confirmed list

**Files:**
- Modify: `server/src/storage/paths.ts`, `server/src/storage/dossiers.ts`, `server/src/domain/types.ts`, `server/src/routes/dossiers.ts`, `server/src/routes/prepare.ts`, `server/src/pipeline/interview.ts`, `FILEMAP.md`
- Test: `server/test/storage/dossiers.test.ts`, `server/test/routes/prepare.test.ts`

**Interfaces:**
- Consumes: `ConfirmedName` from `server/src/domain/privacy.js`, `suggestNames` from `server/src/domain/suggest.js`
- Produces:
  - `PrivacySchema` / `Privacy` in `domain/types.ts`: `{ names: ConfirmedName[]; reviewedAt: string }`
  - `DossierStore.readPrivacy(id): Promise<Privacy | null>` and `DossierStore.writePrivacy(id, privacy): Promise<void>`
  - `GET /api/dossiers/:id/privacy` → `{ suggested: ConfirmedName[]; detected: Detection[]; confirmed: ConfirmedName[] | null }`
  - `PUT /api/dossiers/:id/privacy` with body `{ names: ConfirmedName[] }` → the stored `Privacy`

- [ ] **Step 1: Write the failing test**

Append to `server/test/storage/dossiers.test.ts`:

```ts
  it('round-trips the privacy list', async () => {
    const store = await makeStore()
    const created = await store.create({
      company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité', sites: [],
      language: 'fr', provider: 'gemini', model: 'm',
    })
    expect(await store.readPrivacy(created.id)).toBeNull()
    await store.writePrivacy(created.id, {
      names: [{ value: 'Pierre Séré', kind: 'candidate' }], reviewedAt: '2026-08-31T00:00:00.000Z',
    })
    expect((await store.readPrivacy(created.id))?.names).toEqual([{ value: 'Pierre Séré', kind: 'candidate' }])
  })
```

Use the file's existing store-construction helper; if it inlines `new DossierStore(dir)` instead of a `makeStore` helper, follow that local style.

Append to `server/test/routes/prepare.test.ts` (following the existing app-construction helper in that file):

```ts
  it('suggests names then stores the confirmed list', async () => {
    const { app, store } = await makeApp()
    const dossier = await store.create({
      company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité', sites: [],
      language: 'fr', provider: 'gemini', model: 'fake',
    })
    await store.writeText(dossier.id, 'resume', 'Pierre Séré\nCoordonnateur qualité\n')

    const get = await app.request(`/api/dossiers/${dossier.id}/privacy`)
    expect(get.status).toBe(200)
    const body = (await get.json()) as { suggested: { value: string }[]; confirmed: unknown }
    expect(body.suggested).toContainEqual({ value: 'Pierre Séré', kind: 'candidate' })
    expect(body.confirmed).toBeNull()

    const put = await app.request(`/api/dossiers/${dossier.id}/privacy`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ names: [{ value: 'Pierre Séré', kind: 'candidate' }] }),
    })
    expect(put.status).toBe(200)
    expect((await store.readPrivacy(dossier.id))?.names).toHaveLength(1)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server -- dossiers prepare`
Expected: FAIL — `store.readPrivacy is not a function`, and 404 on the privacy route.

- [ ] **Step 3: Add the schema**

In `server/src/domain/types.ts`, after `DossierSchema`:

```ts
export const ConfirmedNameSchema = z.object({
  value: z.string().min(1),
  kind: z.enum(['candidate', 'person']),
})
export const PrivacySchema = z.object({
  names: z.array(ConfirmedNameSchema),
  reviewedAt: z.string(),
})
export type Privacy = z.infer<typeof PrivacySchema>
```

- [ ] **Step 4: Add the path and the store methods**

In `server/src/storage/paths.ts`, widen the `jsonPath` name union:

```ts
export function jsonPath(dataDir: string, id: string, name: 'analysis' | 'plan' | 'privacy'): string {
```

In `server/src/storage/dossiers.ts`, add two methods next to the existing JSON helpers:

```ts
  async readPrivacy(id: string): Promise<Privacy | null> {
    return readJsonFile(jsonPath(this.dataDir, id, 'privacy'), PrivacySchema)
  }

  async writePrivacy(id: string, privacy: Privacy): Promise<void> {
    await writeJsonFile(jsonPath(this.dataDir, id, 'privacy'), privacy)
  }
```

Match the file's existing field name for the data directory and its import style.

- [ ] **Step 5: Add the routes**

In `server/src/routes/prepare.ts`, add both handlers, following the file's existing dossier-lookup and error style:

```ts
  route.get('/dossiers/:id/privacy', async (c) => {
    const id = c.req.param('id')
    const dossier = await dossiers.read(id)
    const [resume, offer, confirmed] = await Promise.all([
      dossiers.readText(id, 'resume'),
      dossiers.readText(id, 'offer'),
      dossiers.readPrivacy(id),
    ])
    const keep = [dossier.company, dossier.position]
    const suggested = suggestNames(resume, offer, keep)
    const personal = personalDataOf(dossier, confirmed?.names ?? suggested)
    return c.json({
      suggested,
      detected: detect(`${resume}\n${offer}`, personal),
      confirmed: confirmed?.names ?? null,
    })
  })

  route.put('/dossiers/:id/privacy', zValidator('json', z.object({ names: z.array(ConfirmedNameSchema) })), async (c) => {
    const id = c.req.param('id')
    await dossiers.read(id)
    const privacy = { names: c.req.valid('json').names, reviewedAt: new Date().toISOString() }
    await dossiers.writePrivacy(id, privacy)
    return c.json(privacy)
  })
```

Use the same zod-validator import the file already uses for its other routes.

- [ ] **Step 6: Feed the stored list into the pipelines**

In `server/src/routes/prepare.ts`, replace both `personalDataOf(dossier, [])` calls with the stored list:

```ts
    const privacy = await dossiers.readPrivacy(id)
    const personal = personalDataOf(dossier, privacy?.names ?? [])
```

In `server/src/pipeline/interview.ts`, inside `runTurn`, read the stored list next to the existing dossier load and use it for the stream call, replacing the empty array from Task 3:

```ts
  const privacy = await deps.dossiers.readPrivacy(input.dossierId)
```

```ts
    personal: personalDataOf(dossier, privacy?.names ?? []),
```

- [ ] **Step 7: Run the tests**

Run: `npm run typecheck --workspace=server`
Then: `npm run test --workspace=server`
Expected: PASS.

- [ ] **Step 8: Update FILEMAP.md and commit**

Update the `paths.ts`, `dossiers.ts` (storage), `domain/types.ts` and `routes/prepare.ts` lines to mention `privacy.json`, `PrivacySchema`, `readPrivacy`/`writePrivacy` and the two privacy routes.

```bash
git add server/src server/test FILEMAP.md
git commit -m "feat(server): store the confirmed masking list per dossier"
```

---

### Task 5: The review screen

**Files:**
- Create: `web/src/components/PrivacyReview.tsx`, `web/test/PrivacyReview.test.tsx`
- Modify: `web/src/services/api.ts`, `web/src/types.ts`, `web/src/i18n/fr.json`, `web/src/i18n/en.json`, `web/src/styles.css`, `FILEMAP.md`

**Interfaces:**
- Consumes: `GET`/`PUT /api/dossiers/:id/privacy` from Task 4
- Produces:
  - `web/src/types.ts`: `ConfirmedName`, `Detection`, `PrivacyReviewData`
  - `web/src/services/api.ts`: `getPrivacy(id): Promise<PrivacyReviewData>`, `putPrivacy(id, names): Promise<void>`
  - `PrivacyReview({ id, onConfirmed }: { id: string; onConfirmed: () => void })`

- [ ] **Step 1: Add the types and the API functions**

In `web/src/types.ts`:

```ts
export interface ConfirmedName {
  value: string
  kind: 'candidate' | 'person'
}

export interface Detection {
  value: string
  kind: 'candidate' | 'person' | 'email' | 'phone' | 'postal' | 'profile'
  context: string
}

export interface PrivacyReviewData {
  suggested: ConfirmedName[]
  detected: Detection[]
  confirmed: ConfirmedName[] | null
}
```

In `web/src/services/api.ts`, next to the other dossier functions:

```ts
export function getPrivacy(id: string): Promise<PrivacyReviewData> {
  return request<PrivacyReviewData>(`/api/dossiers/${id}/privacy`)
}

export function putPrivacy(id: string, names: ConfirmedName[]): Promise<void> {
  return request<void>(`/api/dossiers/${id}/privacy`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ names }),
  })
}
```

Match the existing `request` call style in that file.

- [ ] **Step 2: Write the failing test**

Create `web/test/PrivacyReview.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { PrivacyReview } from '../src/components/PrivacyReview'
import * as api from '../src/services/api'

vi.mock('../src/services/api')

describe('PrivacyReview', () => {
  beforeEach(() => {
    vi.mocked(api.getPrivacy).mockResolvedValue({
      suggested: [{ value: 'Pierre Séré', kind: 'candidate' }],
      detected: [{ value: 'pierre@example.com', kind: 'email', context: 'écrire à pierre@example.com' }],
      confirmed: null,
    })
    vi.mocked(api.putPrivacy).mockResolvedValue(undefined)
  })

  it('confirms the suggested names and calls onConfirmed', async () => {
    const onConfirmed = vi.fn()
    render(
      <I18nProvider>
        <PrivacyReview id="ben-mor" onConfirmed={onConfirmed} />
      </I18nProvider>
    )
    await screen.findByText('Pierre Séré')
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    await waitFor(() => expect(api.putPrivacy).toHaveBeenCalledWith('ben-mor', [
      { value: 'Pierre Séré', kind: 'candidate' },
    ]))
    expect(onConfirmed).toHaveBeenCalledOnce()
  })

  it('drops an unchecked name from what gets saved', async () => {
    render(
      <I18nProvider>
        <PrivacyReview id="ben-mor" onConfirmed={vi.fn()} />
      </I18nProvider>
    )
    fireEvent.click(await screen.findByRole('checkbox', { name: /Pierre Séré/ }))
    fireEvent.click(screen.getByRole('button', { name: /continuer/i }))
    await waitFor(() => expect(api.putPrivacy).toHaveBeenCalledWith('ben-mor', []))
  })

  it('lists regex detections without a checkbox', async () => {
    render(
      <I18nProvider>
        <PrivacyReview id="ben-mor" onConfirmed={vi.fn()} />
      </I18nProvider>
    )
    await screen.findByText('pierre@example.com')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=web -- PrivacyReview`
Expected: FAIL — cannot resolve `../src/components/PrivacyReview`.

- [ ] **Step 4: Write the component**

Create `web/src/components/PrivacyReview.tsx` (keep it under the 200-LOC component limit):

```tsx
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { getPrivacy, putPrivacy } from '../services/api.js'
import type { ConfirmedName, Detection, PrivacyReviewData } from '../types.js'

interface PrivacyReviewProps {
  id: string
  onConfirmed: () => void
}

function keyOf(name: ConfirmedName): string {
  return `${name.kind}:${name.value}`
}

/** The excerpt where a name was found, so the user can judge a false positive on sight. */
function contextOf(name: ConfirmedName, detected: readonly Detection[]): string {
  return detected.find((d) => d.value === name.value)?.context ?? ''
}

export function PrivacyReview({ id, onConfirmed }: PrivacyReviewProps) {
  const t = useT()
  const [data, setData] = useState<PrivacyReviewData | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [extra, setExtra] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void getPrivacy(id).then((loaded) => {
      if (!alive) return
      const names = loaded.confirmed ?? loaded.suggested
      setData(loaded)
      setChecked(new Set(names.map(keyOf)))
    })
    return () => {
      alive = false
    }
  }, [id])

  if (data === null) return null

  const names: ConfirmedName[] = [...(data.confirmed ?? data.suggested)]
  const rules: Detection[] = data.detected.filter((d) => d.kind !== 'candidate' && d.kind !== 'person')

  const toggle = (name: ConfirmedName): void => {
    setChecked((current) => {
      const next = new Set(current)
      const key = keyOf(name)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const addExtra = (): void => {
    const value = extra.trim()
    if (value === '') return
    const name: ConfirmedName = { value, kind: 'person' }
    setData({ ...data, suggested: [...names, name] })
    setChecked((current) => new Set(current).add(keyOf(name)))
    setExtra('')
  }

  const confirm = async (): Promise<void> => {
    setSaving(true)
    try {
      await putPrivacy(id, names.filter((name) => checked.has(keyOf(name))))
      onConfirmed()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel privacy-review">
      <h2>{t('privacy.title')}</h2>
      <p className="form-hint">{t('privacy.intro')}</p>

      <h3>{t('privacy.names')}</h3>
      <ul className="privacy-list">
        {names.map((name) => (
          <li key={keyOf(name)}>
            <label>
              <input type="checkbox" checked={checked.has(keyOf(name))} onChange={() => toggle(name)} />
              <span>{name.value}</span>
              <span className="privacy-kind">{t(`privacy.kind.${name.kind}`)}</span>
              <span className="privacy-context">{contextOf(name, data.detected)}</span>
            </label>
          </li>
        ))}
      </ul>

      <label htmlFor="privacy-extra">{t('privacy.add')}</label>
      <div className="privacy-add">
        <input id="privacy-extra" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button type="button" className="btn" onClick={addExtra}>
          {t('privacy.addAction')}
        </button>
      </div>

      <h3>{t('privacy.always')}</h3>
      <ul className="privacy-list">
        {rules.map((d) => (
          <li key={`${d.kind}:${d.value}`}>
            <span>{d.value}</span>
            <span className="privacy-kind">{t(`privacy.kind.${d.kind}`)}</span>
            <span className="privacy-context">{d.context}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-primary btn-big" disabled={saving} onClick={() => void confirm()}>
        {t('privacy.confirm')}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Add the translations**

In `web/src/i18n/fr.json`:

```json
  "privacy.title": "Ce qui sera masqué",
  "privacy.intro": "Avant d'envoyer quoi que ce soit à l'IA, on remplace ces informations par des étiquettes. Vérifie la liste : ce que nous avons manqué, ajoute-le.",
  "privacy.names": "Noms détectés",
  "privacy.always": "Toujours masqué",
  "privacy.add": "Ajouter un nom",
  "privacy.addAction": "Ajouter",
  "privacy.confirm": "Continuer",
  "privacy.kind.candidate": "toi",
  "privacy.kind.person": "autre personne",
  "privacy.kind.email": "courriel",
  "privacy.kind.phone": "téléphone",
  "privacy.kind.postal": "code postal",
  "privacy.kind.profile": "profil",
```

In `web/src/i18n/en.json`, the same keys:

```json
  "privacy.title": "What gets hidden",
  "privacy.intro": "Before anything reaches the AI, we replace these details with labels. Check the list, and add whatever we missed.",
  "privacy.names": "Detected names",
  "privacy.always": "Always hidden",
  "privacy.add": "Add a name",
  "privacy.addAction": "Add",
  "privacy.confirm": "Continue",
  "privacy.kind.candidate": "you",
  "privacy.kind.person": "someone else",
  "privacy.kind.email": "email",
  "privacy.kind.phone": "phone",
  "privacy.kind.postal": "postal code",
  "privacy.kind.profile": "profile",
```

- [ ] **Step 6: Add the styles**

In `web/src/styles.css`, before the `.dossier-grid` block:

```css
.privacy-review {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.privacy-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.privacy-list label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}

.privacy-kind {
  color: var(--muted);
  font-size: 12px;
}

.privacy-context {
  color: var(--muted);
  font-size: 12px;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.privacy-add {
  display: flex;
  gap: 8px;
}

.privacy-add input {
  flex: 1;
}
```

- [ ] **Step 7: Run the tests**

Run: `npm run typecheck --workspace=web`
Then: `npm run test --workspace=web`
Expected: PASS, including the fr/en key-parity test in `i18n.test.tsx`.

- [ ] **Step 8: Update FILEMAP.md and commit**

```bash
git add web/src web/test FILEMAP.md
git commit -m "feat(web): masking review screen"
```

---

### Task 6: Interception in the prepare flow

**Files:**
- Modify: `web/src/components/PrepareScreen.tsx`, `web/src/hooks/useDossier.ts`, `web/src/i18n/fr.json`, `web/src/i18n/en.json`, `FILEMAP.md`
- Test: `web/test/PrepareScreen.test.tsx` (create)

**Interfaces:**
- Consumes: `PrivacyReview` from Task 5, `getPrivacy` from Task 4
- Produces: the review screen shown once per dossier before the first analysis, plan or interview

- [ ] **Step 1: Write the failing test**

Create `web/test/PrepareScreen.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { PrepareScreen } from '../src/components/PrepareScreen'
import * as api from '../src/services/api'

vi.mock('../src/services/api')

const BUNDLE = {
  dossier: {
    id: 'ben-mor', company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité', sites: [],
    language: 'fr' as const, provider: 'gemini' as const, model: 'm', createdAt: '', updatedAt: '',
  },
  offer: 'offre', resume: 'CV', company: '', documents: [], analysis: null, plan: null,
}

describe('PrepareScreen', () => {
  beforeEach(() => {
    vi.mocked(api.getDossier).mockResolvedValue(BUNDLE)
    vi.mocked(api.getPrivacy).mockResolvedValue({
      suggested: [{ value: 'Pierre Séré', kind: 'candidate' }], detected: [], confirmed: null,
    })
  })

  it('shows the review screen while the dossier has no confirmed list', async () => {
    render(
      <I18nProvider>
        <PrepareScreen id="ben-mor" onInterview={vi.fn()} />
      </I18nProvider>
    )
    expect(await screen.findByText('Ce qui sera masqué')).toBeInTheDocument()
  })

  it('shows the checklist once the list is confirmed', async () => {
    vi.mocked(api.getPrivacy).mockResolvedValue({
      suggested: [], detected: [], confirmed: [{ value: 'Pierre Séré', kind: 'candidate' }],
    })
    render(
      <I18nProvider>
        <PrepareScreen id="ben-mor" onInterview={vi.fn()} />
      </I18nProvider>
    )
    expect(await screen.findByText(/étapes prêtes/)).toBeInTheDocument()
  })
})
```

Match `api.getDossier` to whatever the existing `useDossier` hook actually calls; if the name differs, mock that function instead.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=web -- PrepareScreen`
Expected: FAIL — the review screen is not rendered.

- [ ] **Step 3: Gate the checklist on the confirmed list**

In `web/src/components/PrepareScreen.tsx`, add the state and the early return, keeping the component under 200 LOC (extract the checklist body into a local `Checklist` sub-component in the same file if it goes over):

```tsx
  const [reviewed, setReviewed] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    void getPrivacy(id).then((privacy) => {
      if (alive) setReviewed(privacy.confirmed !== null)
    })
    return () => {
      alive = false
    }
  }, [id])

  if (reviewed === null || !bundle) return null
  if (!reviewed) return <PrivacyReview id={id} onConfirmed={() => setReviewed(true)} />
```

Add a `prepare.privacy` button to the sub-tab row so the screen stays reachable afterwards:

```tsx
        <button type="button" className="btn" onClick={() => setReviewed(false)}>
          {t('prepare.privacy')}
        </button>
```

- [ ] **Step 4: Add the translations**

`web/src/i18n/fr.json`: `"prepare.privacy": "Confidentialité"`
`web/src/i18n/en.json`: `"prepare.privacy": "Privacy"`

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck --workspace=web`
Then: `npm run test --workspace=web`
Expected: PASS.

- [ ] **Step 6: Update FILEMAP.md and commit**

```bash
git add web/src web/test FILEMAP.md
git commit -m "feat(web): require the masking review before the first AI call"
```

---

### Task 7: The compliance frontier test

The proof cited by the ÉFVP: whatever the pipelines do, no personal value reaches a provider.

**Files:**
- Create: `server/test/privacy-frontier.test.ts`
- Modify: `docs/conformite-loi-25.md`, `FILEMAP.md`

**Interfaces:**
- Consumes: `analyze` from `server/src/pipeline/analysis.js`, `runTurn` from `server/src/pipeline/interview.js`, `FakeProvider`, `personalDataOf`

- [ ] **Step 1: Write the test**

Create `server/test/privacy-frontier.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { analyze } from '../src/pipeline/analysis.js'
import { withMasking } from '../src/providers/masked.js'
import { FakeProvider } from '../src/providers/fake.js'
import { personalDataOf } from '../src/domain/privacy.js'
import type { Dossier } from '../src/domain/types.js'

const DOSSIER = {
  id: 'ben-mor', company: 'Câbles Ben-Mor', position: 'Coordonnateur qualité', sites: [],
  language: 'fr', provider: 'gemini', model: 'fake', createdAt: '', updatedAt: '',
} as Dossier

const RESUME = `Pierre Séré
pierre.sere@example.com · 514-555-0123 · H2X 1Y4
https://www.linkedin.com/in/pierre-sere
Coordonnateur qualité depuis 2019 chez Câbles Ben-Mor.
Séré a piloté la certification ISO 9001:2015.`

const OFFER = `Câbles Ben-Mor recrute un coordonnateur qualité.
Contact : Marie Tremblay, marie.tremblay@example.com`

const FORBIDDEN = [
  'Pierre Séré', 'Séré', 'pierre.sere@example.com', '514-555-0123', 'H2X 1Y4',
  'linkedin.com/in/pierre-sere', 'Marie Tremblay', 'marie.tremblay@example.com',
]

describe('provider frontier', () => {
  it('never lets a personal value reach the provider', async () => {
    const fake = new FakeProvider({
      structured: { requirements: [], summary: 'a. b. c.' },
    })
    await analyze({
      provider: withMasking(fake),
      model: 'fake',
      offer: OFFER,
      resume: RESUME,
      language: 'fr',
      personal: personalDataOf(DOSSIER, [
        { value: 'Pierre Séré', kind: 'candidate' },
        { value: 'Séré', kind: 'candidate' },
        { value: 'Marie Tremblay', kind: 'person' },
      ]),
      signal: new AbortController().signal,
    })

    const sent = JSON.stringify(fake.calls)
    for (const value of FORBIDDEN) expect(sent).not.toContain(value)
    expect(sent).toContain('Câbles Ben-Mor')
    expect(sent).toContain('Coordonnateur qualité')
  })
})
```

The last two assertions matter as much as the others: they prove the company and the position survive, so the product still works.

- [ ] **Step 2: Run the test**

Run: `npm run test --workspace=server -- frontier`
Expected: PASS. If it fails, the masking rules are wrong — fix `domain/privacy.ts`, not the test.

- [ ] **Step 3: Run everything**

Run: `npm run typecheck --workspaces`
Then: `npm run test --workspaces`
Expected: PASS.

- [ ] **Step 4: Point the compliance doc at the proof**

In `docs/conformite-loi-25.md`, in the "Plan de mise en conformité" section, append to item 1:

```markdown
   Preuve : `server/test/privacy-frontier.test.ts` échoue si une valeur personnelle atteint un provider.
```

- [ ] **Step 5: Update FILEMAP.md and commit**

```markdown
- `server/test/privacy-frontier.test.ts` — compliance proof: runs `analyze` through `withMasking(FakeProvider)` with a realistic resume and offer, asserts no personal value (names, email, phone, postal code, LinkedIn profile) appears in the captured payloads while the company and position still do
```

```bash
git add server/test/privacy-frontier.test.ts docs/conformite-loi-25.md FILEMAP.md
git commit -m "test(server): compliance frontier test for the provider boundary"
```
