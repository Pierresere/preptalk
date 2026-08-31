# PrepTalk — Server Implementation Plan (part 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local Node server of PrepTalk: dossier storage on disk, provider abstraction (OpenAI / Anthropic / Gemini), company research, offer-vs-resume analysis, interview plan generation, and the streaming interview simulation with coaching and debrief.

**Architecture:** A Hono HTTP server (TypeScript, ESM) reads and writes one folder per application under `DATA_DIR`. Every AI call goes through a `Provider` interface with three methods (`stream`, `structured`, `search`); a `FakeProvider` makes the whole pipeline testable without keys. The interview engine (turn → phase, lexical retrieval, system-prompt assembly) is pure functions with no I/O.

**Tech Stack:** Node 22, TypeScript 5 strict, Hono 4, zod 3, `@anthropic-ai/sdk`, `openai`, `@google/genai`, Vitest, tsx.

**Spec:** `E:\App interview\docs\superpowers\specs\2026-08-31-preptalk-design.md`

## Global Constraints

- TypeScript `strict: true`; **never `any`** (use `unknown`).
- Component ≤ 200 LOC, hook ≤ 150, service ≤ 300, function ≤ 40 LOC.
- No `console.log`, no `TODO` without written justification.
- Code, identifiers, comments in **English**. User-facing strings via i18n (web) — the server returns language-neutral data; AI prompts are in English and instruct the model to answer in `dossier.language`.
- `FILEMAP.md` at repo root updated in every task that creates/deletes files.
- Port `4820`; env vars `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `DATA_DIR` (default `../data`).
- Default models: `gpt-5.6-luna` (OpenAI), `claude-opus-5` (Anthropic), `gemini-3.7-flash` (Gemini). Listed models are constants; the user picks one in the UI.
- All commands run from `E:\App interview` unless stated. Use PowerShell-compatible commands (no `&&`).

## File Structure (server)

```
package.json                     workspaces ["server","web"], root scripts
tsconfig.base.json               shared strict compiler options
server/package.json
server/tsconfig.json
server/.env.example
server/src/index.ts              boots Hono on 4820, serves web/dist
server/src/app.ts                createApp(deps) — routes mounted here (testable)
server/src/config.ts             reads env → Config { dataDir, keys }
server/src/domain/types.ts       Dossier, Plan, Phase, Persona, Analysis, Session, Message (zod schemas + types)
server/src/domain/skeleton.ts    the 7-phase universal skeleton
server/src/domain/phases.ts      phaseForTurn, closedPhases, totalQuestions, turnFromHistory
server/src/domain/retrieval.ts   tokenize, scoreChunks, selectChunks (lexical)
server/src/domain/prompt.ts      buildInterviewSystem(plan, turn, chunks, language)
server/src/domain/sections.ts    company research sections + query builders
server/src/storage/paths.ts      slugify, dossierDir, file paths
server/src/storage/dossiers.ts   list/create/read/update/delete dossier, read/write text files
server/src/storage/sessions.ts   list/create/read/append session
server/src/providers/types.ts    Provider interface, Message, StreamInput, SearchResult
server/src/providers/fake.ts     FakeProvider for tests
server/src/providers/openai.ts
server/src/providers/anthropic.ts
server/src/providers/gemini.ts
server/src/providers/registry.ts createProviders(config) → Map<ProviderId, Provider>
server/src/pipeline/research.ts  researchSection(provider, dossier, section) → markdown block
server/src/pipeline/analysis.ts  analyze(provider, offer, resume) → Analysis
server/src/pipeline/plan.ts      generatePlan(provider, dossier, offer, resume, company, analysis) → Plan
server/src/pipeline/chunks.ts    buildChunks(dossierFiles) → Chunk[]
server/src/pipeline/interview.ts runTurn(deps, dossierId, sessionId, userText, callbacks)
server/src/routes/providers.ts   GET /api/providers
server/src/routes/dossiers.ts    CRUD + offer/resume/documents
server/src/routes/prepare.ts     company research, analysis, plan
server/src/routes/sessions.ts    sessions + SSE turn
server/test/**                   Vitest specs, mirrors src/
```

---

### Task 1: Monorepo scaffold and server skeleton

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/.env.example`, `server/src/config.ts`, `server/src/app.ts`, `server/src/index.ts`, `FILEMAP.md`, `README.md`
- Test: `server/test/app.test.ts`

**Interfaces:**
- Produces: `createApp(deps: AppDeps): Hono` where `AppDeps = { config: Config; providers: ProviderMap }` (providers added in Task 5; use `ReadonlyMap<string, unknown>` placeholder now and tighten in Task 5), `readConfig(env: NodeJS.ProcessEnv): Config` with `Config = { dataDir: string; port: number; keys: { openai?: string; anthropic?: string; gemini?: string } }`.

- [ ] **Step 1: Root package.json and base tsconfig**

```json
{
  "name": "preptalk",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "npm run dev --workspace=server",
    "start": "npm run build --workspace=web; npm run start --workspace=server",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: server/package.json, tsconfig, vitest config, .env.example**

```json
{
  "name": "@preptalk/server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.80.0",
    "@google/genai": "^1.20.0",
    "@hono/node-server": "^1.14.0",
    "hono": "^4.7.0",
    "openai": "^6.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```
(Versions are floors; `npm install` resolves the latest compatible. If a package name resolves differently, fix the version, not the name.)

`server/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "compilerOptions": { "rootDir": ".", "types": ["node"] }, "include": ["src", "test"] }
```
`server/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
```
`server/.env.example`:
```
# Put at least one key. The UI only shows providers whose key is present.
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
# Where application folders live (default: ../data)
DATA_DIR=
PORT=4820
```

- [ ] **Step 3: Write the failing test**

`server/test/app.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { readConfig } from '../src/config.js'

describe('app', () => {
  it('answers health', async () => {
    const app = createApp({ config: readConfig({ DATA_DIR: 'tmp' }), providers: new Map() })
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('reads config with defaults', () => {
    const config = readConfig({})
    expect(config.port).toBe(4820)
    expect(config.dataDir.endsWith('data')).toBe(true)
    expect(config.keys).toEqual({})
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm install; npm test --workspace=server`
Expected: FAIL — cannot find `../src/app.js`.

- [ ] **Step 5: Implement config.ts, app.ts, index.ts**

`server/src/config.ts`:
```ts
import path from 'node:path'

export interface Config {
  readonly dataDir: string
  readonly port: number
  readonly keys: { readonly openai?: string; readonly anthropic?: string; readonly gemini?: string }
}

function nonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value.trim() : undefined
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const keys: { openai?: string; anthropic?: string; gemini?: string } = {}
  const openai = nonEmpty(env['OPENAI_API_KEY'])
  const anthropic = nonEmpty(env['ANTHROPIC_API_KEY'])
  const gemini = nonEmpty(env['GEMINI_API_KEY'])
  if (openai !== undefined) keys.openai = openai
  if (anthropic !== undefined) keys.anthropic = anthropic
  if (gemini !== undefined) keys.gemini = gemini
  const port = Number(nonEmpty(env['PORT']) ?? '4820')
  return {
    dataDir: path.resolve(nonEmpty(env['DATA_DIR']) ?? path.join(process.cwd(), '..', 'data')),
    port: Number.isFinite(port) ? port : 4820,
    keys,
  }
}
```

`server/src/app.ts`:
```ts
import { Hono } from 'hono'
import type { Config } from './config.js'

export interface AppDeps {
  readonly config: Config
  readonly providers: ReadonlyMap<string, unknown>
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ ok: true }))
  void deps
  return app
}
```

`server/src/index.ts`:
```ts
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'
import { readConfig } from './config.js'

const config = readConfig(process.env)
const app = createApp({ config, providers: new Map() })
app.use('/*', serveStatic({ root: '../web/dist' }))
app.get('*', serveStatic({ path: '../web/dist/index.html' }))
serve({ fetch: app.fetch, port: config.port })
process.stdout.write(`PrepTalk server on http://localhost:${config.port}\n`)
```
Note: `tsx` loads `.env` only if you add `import 'dotenv/config'`; instead run with `node --env-file=.env` semantics — use `"dev": "tsx watch --env-file=.env src/index.ts"` and `"start": "tsx --env-file=.env src/index.ts"` (tsx forwards `--env-file` to Node 22). Update `server/package.json` scripts accordingly.

- [ ] **Step 6: Run tests, typecheck**

Run: `npm test --workspace=server; npm run typecheck --workspace=server`
Expected: 2 tests PASS, typecheck clean.

- [ ] **Step 7: FILEMAP.md and README.md**

`FILEMAP.md` lists every file created so far with one line each (same format as the File Structure section). `README.md`: project name, one paragraph, `npm install`, copy `server/.env.example` to `server/.env`, `npm run dev`. Keep the README under 40 lines for now.

- [ ] **Step 8: Commit**

```powershell
git add -A; git commit -m "chore: monorepo scaffold and server skeleton"
```

---

### Task 2: Domain types and the universal skeleton

**Files:**
- Create: `server/src/domain/types.ts`, `server/src/domain/skeleton.ts`
- Test: `server/test/domain/types.test.ts`

**Interfaces:**
- Produces (zod schemas and inferred types, all exported):
  - `ProviderIdSchema = z.enum(['openai','anthropic','gemini'])`, `ProviderId`
  - `LanguageSchema = z.enum(['fr','en'])`, `Language`
  - `DossierSchema`: `{ id, company, position, sites: string[], language, provider: ProviderId, model, createdAt, updatedAt }` (ISO strings), `Dossier`
  - `PersonaSchema { name, role, concerns, tone }`, `Persona`
  - `PhaseSchema { id, title, questions: int ≥ 1, objective, targeting: string[], examples: string[] }`, `Phase`
  - `PlanSchema { persona, phases: Phase[] (min 1) }`, `Plan`
  - `RequirementSchema { index, text, keywords: string[], status: 'covered'|'partial'|'missing', evidence }`, `AnalysisSchema { requirements: Requirement[], summary: string }`, `Analysis`
  - `MessageSchema { role: 'user'|'assistant', text, sources?: string[] }`, `Message`
  - `SessionSchema { id, dossierId, provider, model, startedAt, messages: Message[], debrief: string | null }`, `Session`
  - `SKELETON: readonly SkeletonPhase[]` with `SkeletonPhase = { id, questions, guidance }` for the 7 phases + `LANGUAGE_SWITCH: SkeletonPhase`.

- [ ] **Step 1: Write the failing test**

`server/test/domain/types.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { PlanSchema, DossierSchema } from '../../src/domain/types.js'
import { SKELETON, LANGUAGE_SWITCH } from '../../src/domain/skeleton.js'

describe('schemas', () => {
  it('rejects a plan without phases', () => {
    const result = PlanSchema.safeParse({ persona: { name: 'A', role: 'B', concerns: 'C', tone: 'D' }, phases: [] })
    expect(result.success).toBe(false)
  })
  it('accepts a minimal dossier', () => {
    const result = DossierSchema.safeParse({
      id: 'acme', company: 'Acme', position: 'QA lead', sites: [], language: 'fr',
      provider: 'gemini', model: 'gemini-3.7-flash',
      createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('skeleton', () => {
  it('has seven phases totalling 16 questions', () => {
    expect(SKELETON.map((p) => p.id)).toEqual(['welcome','core','domain','situations','behavior','sensitive','questions'])
    expect(SKELETON.reduce((n, p) => n + p.questions, 0)).toBe(16)
    expect(LANGUAGE_SWITCH.questions).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement types.ts**

```ts
import { z } from 'zod'

export const ProviderIdSchema = z.enum(['openai', 'anthropic', 'gemini'])
export type ProviderId = z.infer<typeof ProviderIdSchema>
export const LanguageSchema = z.enum(['fr', 'en'])
export type Language = z.infer<typeof LanguageSchema>

export const DossierSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  position: z.string().min(1),
  sites: z.array(z.string()),
  language: LanguageSchema,
  provider: ProviderIdSchema,
  model: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Dossier = z.infer<typeof DossierSchema>

export const PersonaSchema = z.object({
  name: z.string(), role: z.string(), concerns: z.string(), tone: z.string(),
})
export type Persona = z.infer<typeof PersonaSchema>

export const PhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  questions: z.number().int().min(1),
  objective: z.string(),
  targeting: z.array(z.string()),
  examples: z.array(z.string()),
})
export type Phase = z.infer<typeof PhaseSchema>

export const PlanSchema = z.object({ persona: PersonaSchema, phases: z.array(PhaseSchema).min(1) })
export type Plan = z.infer<typeof PlanSchema>

export const RequirementSchema = z.object({
  index: z.number().int(),
  text: z.string(),
  keywords: z.array(z.string()),
  status: z.enum(['covered', 'partial', 'missing']),
  evidence: z.string(),
})
export type Requirement = z.infer<typeof RequirementSchema>
export const AnalysisSchema = z.object({ requirements: z.array(RequirementSchema), summary: z.string() })
export type Analysis = z.infer<typeof AnalysisSchema>

export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  sources: z.array(z.string()).optional(),
})
export type Message = z.infer<typeof MessageSchema>

export const SessionSchema = z.object({
  id: z.string(),
  dossierId: z.string(),
  provider: ProviderIdSchema,
  model: z.string(),
  startedAt: z.string(),
  messages: z.array(MessageSchema),
  debrief: z.string().nullable(),
})
export type Session = z.infer<typeof SessionSchema>
```

- [ ] **Step 4: Implement skeleton.ts**

```ts
/**
 * The universal interview skeleton. Every interview walks these phases in
 * order; the AI only fills objective, targeting and examples for the dossier.
 * `guidance` tells the plan generator what each phase should draw on.
 */
export interface SkeletonPhase {
  readonly id: string
  readonly questions: number
  readonly guidance: string
}

export const SKELETON: readonly SkeletonPhase[] = [
  { id: 'welcome', questions: 2, guidance: 'Career path coherence and real motivation for this company. Draw on the resume.' },
  { id: 'core', questions: 3, guidance: 'The heart of the job: the first three responsibilities of the offer. Can the candidate do them, or only talk about them?' },
  { id: 'domain', questions: 3, guidance: 'The company domain: products, services, sector, standards. Has the candidate started learning it?' },
  { id: 'situations', questions: 3, guidance: 'Situational dilemmas where process meets pressure, taken from the offer and the sector.' },
  { id: 'behavior', questions: 2, guidance: 'Behavioral: driving change, a failure, prioritizing. Draw on transitions in the resume.' },
  { id: 'sensitive', questions: 2, guidance: 'The uncomfortable topics: requirements the resume covers partially or not at all, gaps, salary.' },
  { id: 'questions', questions: 1, guidance: 'The candidate asks questions. Draw on the company profile for what a good question would reveal.' },
]

export const LANGUAGE_SWITCH: SkeletonPhase = {
  id: 'language-switch',
  questions: 1,
  guidance: 'Switch to the second language the offer requires and stay in it while the candidate answers in it.',
}
```

- [ ] **Step 5: Run tests, typecheck; update FILEMAP.md; commit**

Run: `npm test --workspace=server; npm run typecheck --workspace=server` → all PASS.
```powershell
git add -A; git commit -m "feat(server): domain schemas and universal skeleton"
```

---

### Task 3: Phase engine (turn → phase)

**Files:**
- Create: `server/src/domain/phases.ts`
- Test: `server/test/domain/phases.test.ts`

**Interfaces:**
- Produces: `turnFromHistory(messages: readonly Message[]): number` (assistant count + 1), `totalQuestions(plan: Plan): number`, `phaseForTurn(plan: Plan, turn: number): Phase | null`, `closedPhases(plan: Plan, turn: number): readonly Phase[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { closedPhases, phaseForTurn, totalQuestions, turnFromHistory } from '../../src/domain/phases.js'
import type { Plan } from '../../src/domain/types.js'

const plan: Plan = {
  persona: { name: 'A', role: 'B', concerns: 'C', tone: 'D' },
  phases: [
    { id: 'welcome', title: 'Welcome', questions: 2, objective: '', targeting: [], examples: [] },
    { id: 'core', title: 'Core', questions: 3, objective: '', targeting: [], examples: [] },
    { id: 'questions', title: 'Yours', questions: 1, objective: '', targeting: [], examples: [] },
  ],
}

describe('phases', () => {
  it('counts turns from assistant replies', () => {
    expect(turnFromHistory([])).toBe(1)
    expect(turnFromHistory([{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'q1' }, { role: 'user', text: 'a1' }])).toBe(2)
  })
  it('maps turn to phase and returns null past the end', () => {
    expect(totalQuestions(plan)).toBe(6)
    expect(phaseForTurn(plan, 1)?.id).toBe('welcome')
    expect(phaseForTurn(plan, 2)?.id).toBe('welcome')
    expect(phaseForTurn(plan, 3)?.id).toBe('core')
    expect(phaseForTurn(plan, 6)?.id).toBe('questions')
    expect(phaseForTurn(plan, 7)).toBeNull()
  })
  it('lists closed phases', () => {
    expect(closedPhases(plan, 1)).toEqual([])
    expect(closedPhases(plan, 4).map((p) => p.id)).toEqual(['welcome'])
    expect(closedPhases(plan, 99).map((p) => p.id)).toEqual(['welcome', 'core', 'questions'])
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npm test --workspace=server` → module not found.

- [ ] **Step 3: Implement**

```ts
import type { Message, Phase, Plan } from './types.js'

/** Each recruiter reply already given counts as one question asked. */
export function turnFromHistory(messages: readonly Message[]): number {
  return messages.filter((m) => m.role === 'assistant').length + 1
}

export function totalQuestions(plan: Plan): number {
  return plan.phases.reduce((sum, phase) => sum + phase.questions, 0)
}

/** `null` once the plan is exhausted: that is the debrief signal. */
export function phaseForTurn(plan: Plan, turn: number): Phase | null {
  let bound = 0
  for (const phase of plan.phases) {
    bound += phase.questions
    if (turn <= bound) return phase
  }
  return null
}

/** Phases already walked: the model must not reopen them. */
export function closedPhases(plan: Plan, turn: number): readonly Phase[] {
  const current = phaseForTurn(plan, turn)
  if (current === null) return plan.phases
  return plan.phases.slice(0, plan.phases.indexOf(current))
}
```

- [ ] **Step 4: Run tests → PASS. Update FILEMAP.md. Commit** `feat(server): phase engine`.

---

### Task 4: Lexical retrieval

**Files:**
- Create: `server/src/domain/retrieval.ts`
- Test: `server/test/domain/retrieval.test.ts`

**Interfaces:**
- Produces: `interface Chunk { id: string; title: string; kind: 'offer'|'resume'|'company'|'document'|'requirement'; body: string }`, `interface ChunkHit { chunk: Chunk; score: number; reasons: string[] }`, `tokenize(text: string): string[]`, `selectChunks(chunks: readonly Chunk[], query: string, limit?: number): ChunkHit[]` (default limit 6, context budget 60 000 chars, floor `max(6, best*0.3)`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { selectChunks, tokenize, type Chunk } from '../../src/domain/retrieval.js'

const chunks: Chunk[] = [
  { id: 'offer', title: 'Job offer', kind: 'offer', body: 'Plan and lead internal audits. Track corrective actions.' },
  { id: 'company/products', title: 'Products and services', kind: 'company', body: 'Steel wire rope, slings, lifting solutions.' },
  { id: 'resume', title: 'Resume', kind: 'resume', body: 'Quality coordinator, ISO 9001 audits, supplier claims.' },
]

describe('retrieval', () => {
  it('tokenizes with accent folding and stop words removed', () => {
    expect(tokenize('Les élingues et le câble')).toEqual(['elingues', 'cable'])
  })
  it('ranks by title then body and rotates with the query', () => {
    const audit = selectChunks(chunks, 'internal audit corrective')
    expect(audit[0]?.chunk.id).toBe('offer')
    const product = selectChunks(chunks, 'wire rope slings products')
    expect(product[0]?.chunk.id).toBe('company/products')
  })
  it('returns nothing for an empty query', () => {
    expect(selectChunks(chunks, 'le la et')).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** (port of Cerveau's `selectNotes`, bilingual stop words)

```ts
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
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
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
```

- [ ] **Step 4: Run tests → PASS. FILEMAP.md. Commit** `feat(server): lexical retrieval`.

---

### Task 5: Provider interface, FakeProvider, registry

**Files:**
- Create: `server/src/providers/types.ts`, `server/src/providers/fake.ts`, `server/src/providers/registry.ts`
- Modify: `server/src/app.ts` (tighten `providers: ProviderMap`), `server/src/index.ts` (use `createProviders`)
- Test: `server/test/providers/fake.test.ts`

**Interfaces:**
- Produces:
```ts
export interface ChatMessage { readonly role: 'user' | 'assistant'; readonly text: string }
export interface StreamInput { readonly system: string; readonly messages: readonly ChatMessage[]; readonly model: string; readonly temperature: number; readonly signal: AbortSignal }
export interface StructuredInput<T> { readonly system: string; readonly prompt: string; readonly schema: z.ZodType<T>; readonly model: string; readonly signal: AbortSignal }
export interface SearchInput { readonly query: string; readonly model: string; readonly signal: AbortSignal }
export interface SearchResult { readonly text: string; readonly sources: readonly string[] }
export interface Provider {
  readonly id: ProviderId
  readonly models: readonly string[]
  stream(input: StreamInput): AsyncIterable<string>          // yields deltas
  structured<T>(input: StructuredInput<T>): Promise<T>
  search(input: SearchInput): Promise<SearchResult>
}
export type ProviderMap = ReadonlyMap<ProviderId, Provider>
export class ProviderError extends Error { constructor(message: string, readonly status = 502) }
```
- `FakeProvider` constructor `(script: { stream?: string; structured?: unknown; search?: SearchResult })`, records every call in `calls: Array<{ kind: 'stream'|'structured'|'search'; input: unknown }>`.
- `createProviders(config: Config): ProviderMap` — Task 6-8 register real adapters; for now returns an empty map.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FakeProvider } from '../../src/providers/fake.js'

describe('FakeProvider', () => {
  it('streams the scripted text in words', async () => {
    const p = new FakeProvider({ stream: 'hello big world' })
    const parts: string[] = []
    for await (const d of p.stream({ system: '', messages: [], model: 'fake', temperature: 0, signal: new AbortController().signal })) parts.push(d)
    expect(parts.join('')).toBe('hello big world')
    expect(p.calls[0]?.kind).toBe('stream')
  })
  it('validates structured output against the schema', async () => {
    const p = new FakeProvider({ structured: { a: 1 } })
    const out = await p.structured({ system: '', prompt: '', schema: z.object({ a: z.number() }), model: 'fake', signal: new AbortController().signal })
    expect(out).toEqual({ a: 1 })
  })
})
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement types.ts, fake.ts, registry.ts**

`fake.ts`:
```ts
import type { Provider, SearchInput, SearchResult, StreamInput, StructuredInput } from './types.js'

interface Script { readonly stream?: string; readonly structured?: unknown; readonly search?: SearchResult }
interface Call { readonly kind: 'stream' | 'structured' | 'search'; readonly input: unknown }

export class FakeProvider implements Provider {
  readonly id = 'gemini' as const
  readonly models = ['fake'] as const
  readonly calls: Call[] = []
  constructor(private readonly script: Script) {}

  async *stream(input: StreamInput): AsyncIterable<string> {
    this.calls.push({ kind: 'stream', input })
    const words = (this.script.stream ?? 'fake answer').split(' ')
    for (const [i, w] of words.entries()) yield i === 0 ? w : ` ${w}`
  }

  async structured<T>(input: StructuredInput<T>): Promise<T> {
    this.calls.push({ kind: 'structured', input })
    return input.schema.parse(this.script.structured)
  }

  async search(input: SearchInput): Promise<SearchResult> {
    this.calls.push({ kind: 'search', input })
    return this.script.search ?? { text: 'Not found — to verify', sources: [] }
  }
}
```
`registry.ts` returns `new Map()` typed as `Map<ProviderId, Provider>` for now. Update `app.ts` `AppDeps.providers: ProviderMap` and `index.ts` to call `createProviders(config)`.

- [ ] **Step 4: Run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): provider interface and fake provider`.

---

### Task 6: Anthropic adapter

**Files:**
- Create: `server/src/providers/anthropic.ts`
- Modify: `server/src/providers/registry.ts`
- Test: `server/test/providers/anthropic.test.ts` (unit-tests the pure helpers only; no network)

**Interfaces:**
- Produces: `createAnthropicProvider(apiKey: string): Provider`; exported pure helpers `extractSearch(content: readonly Anthropic.ContentBlock[]): SearchResult`.
- Models: `['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']`.

- [ ] **Step 1: Write the failing test for `extractSearch`**

```ts
import { describe, expect, it } from 'vitest'
import { extractSearch } from '../../src/providers/anthropic.js'

describe('anthropic extractSearch', () => {
  it('joins text blocks and collects web result urls', () => {
    const content = [
      { type: 'web_search_tool_result', tool_use_id: 't', content: [
        { type: 'web_search_result', url: 'https://a.example', title: 'A', encrypted_content: '', page_age: null },
      ] },
      { type: 'text', text: 'Acme makes ropes.', citations: null },
    ] as unknown as Parameters<typeof extractSearch>[0]
    expect(extractSearch(content)).toEqual({ text: 'Acme makes ropes.', sources: ['https://a.example'] })
  })
})
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement**

```ts
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ProviderError, type Provider, type SearchInput, type SearchResult, type StreamInput, type StructuredInput } from './types.js'

const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const

export function extractSearch(content: readonly Anthropic.ContentBlock[]): SearchResult {
  const text: string[] = []
  const sources: string[] = []
  for (const block of content) {
    if (block.type === 'text') text.push(block.text)
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const item of block.content) if (item.type === 'web_search_result') sources.push(item.url)
    }
  }
  return { text: text.join('\n'), sources: [...new Set(sources)] }
}

function toMessages(messages: StreamInput['messages']): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.text }))
}

function describe(error: unknown): ProviderError {
  if (error instanceof Anthropic.APIError) return new ProviderError(`Anthropic: ${error.message}`, error.status ?? 502)
  return new ProviderError(error instanceof Error ? error.message : 'Anthropic request failed')
}

export function createAnthropicProvider(apiKey: string): Provider {
  const client = new Anthropic({ apiKey })
  return {
    id: 'anthropic',
    models: MODELS,
    async *stream(input: StreamInput) {
      try {
        const stream = client.messages.stream(
          { model: input.model, max_tokens: 8192, system: input.system, messages: toMessages(input.messages) },
          { signal: input.signal },
        )
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
        }
      } catch (error) { throw describe(error) }
    },
    async structured<T>(input: StructuredInput<T>): Promise<T> {
      try {
        const response = await client.messages.parse(
          { model: input.model, max_tokens: 16000, system: input.system,
            messages: [{ role: 'user', content: input.prompt }],
            output_config: { format: zodOutputFormat(input.schema) } },
          { signal: input.signal },
        )
        if (response.parsed_output === null || response.parsed_output === undefined) throw new ProviderError('Anthropic returned no structured output')
        return input.schema.parse(response.parsed_output)
      } catch (error) { throw describe(error) }
    },
    async search(input: SearchInput): Promise<SearchResult> {
      try {
        const response = await client.messages.create(
          { model: input.model, max_tokens: 4096,
            tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
            messages: [{ role: 'user', content: input.query }] },
          { signal: input.signal },
        )
        return extractSearch(response.content)
      } catch (error) { throw describe(error) }
    },
  }
}
```
Notes for the implementer: `temperature` is intentionally not sent (removed on Claude 5 models). Sampling temperature stays a Provider input for OpenAI/Gemini. If `zodOutputFormat` typing rejects `z.ZodType<T>`, narrow `StructuredInput.schema` to `z.ZodObject<z.ZodRawShape>` — both callers (analysis, plan) pass objects. Compile, and let `tsc` name the exact types; do not invent SDK type names.

- [ ] **Step 4: Register in registry.ts**

```ts
if (config.keys.anthropic !== undefined) map.set('anthropic', createAnthropicProvider(config.keys.anthropic))
```

- [ ] **Step 5: Run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): anthropic provider`.

---

### Task 7: OpenAI adapter

**Files:**
- Create: `server/src/providers/openai.ts`
- Modify: `server/src/providers/registry.ts`
- Test: `server/test/providers/openai.test.ts`

**Interfaces:**
- Produces: `createOpenAiProvider(apiKey: string): Provider`, helper `extractCitations(output: readonly OpenAI.Responses.ResponseOutputItem[]): string[]`.
- Models: `['gpt-5.6-luna', 'gpt-5.6', 'gpt-5.6-mini']` — verify names with `client.models.list()` once during implementation; if a name 404s, replace it with the closest listed model and note it in the commit message.

- [ ] **Step 1: Write the failing test** for `extractCitations`: given an output item `{ type: 'message', content: [{ type: 'output_text', text: 'x', annotations: [{ type: 'url_citation', url: 'https://b.example', title: 'B', start_index: 0, end_index: 1 }] }] }` (cast via `unknown`), expect `['https://b.example']`.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** using the Responses API:

```ts
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
```
- `stream`: `client.responses.create({ model, instructions: system, input: messages.map(m => ({ role: m.role, content: m.text })), temperature, stream: true }, { signal })`; for each event with `event.type === 'response.output_text.delta'` yield `event.delta`.
- `structured`: `client.responses.parse({ model, instructions: system, input: prompt, text: { format: zodTextFormat(schema, 'result') } }, { signal })` → `response.output_parsed`; `null` → `ProviderError`; then `schema.parse`.
- `search`: `client.responses.create({ model, tools: [{ type: 'web_search' }], input: query }, { signal })` → `{ text: response.output_text, sources: extractCitations(response.output) }`.
- `extractCitations`: walk `output` items of `type === 'message'`, their `content` parts of `type === 'output_text'`, and collect `annotations` of `type === 'url_citation'` → `url`, deduplicated.
- Errors: `error instanceof OpenAI.APIError` → `ProviderError(message, status)`.

- [ ] **Step 4: Register; run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): openai provider`.

---

### Task 8: Gemini adapter

**Files:**
- Create: `server/src/providers/gemini.ts`
- Modify: `server/src/providers/registry.ts`
- Test: `server/test/providers/gemini.test.ts`

**Interfaces:**
- Produces: `createGeminiProvider(apiKey: string): Provider`, helper `extractGrounding(metadata: unknown): string[]` reading `groundingChunks[].web.uri`.
- Models: `['gemini-3.7-flash', 'gemini-3.7-pro']`.

- [ ] **Step 1: Write the failing test** for `extractGrounding({ groundingChunks: [{ web: { uri: 'https://c.example', title: 'C' } }, { web: {} }] })` → `['https://c.example']`, and `extractGrounding(undefined)` → `[]`.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** with `@google/genai`:

```ts
import { GoogleGenAI } from '@google/genai'
```
- `const ai = new GoogleGenAI({ apiKey })`.
- `stream`: `ai.models.generateContentStream({ model, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })), config: { systemInstruction: system, temperature, maxOutputTokens: 8192, abortSignal: signal } })`; for each chunk yield `chunk.text ?? ''` when non-empty.
- `structured`: `ai.models.generateContent({ model, contents: prompt, config: { systemInstruction: system, responseMimeType: 'application/json', abortSignal: signal } })` → `JSON.parse(response.text ?? '')` inside try; parse with `schema`; on schema failure retry once appending the zod error message to the prompt (`"Previous answer was invalid: <issues>. Return only valid JSON."`), then throw `ProviderError`.
- `search`: `ai.models.generateContent({ model, contents: query, config: { tools: [{ googleSearch: {} }], abortSignal: signal } })` → `{ text: response.text ?? '', sources: extractGrounding(response.candidates?.[0]?.groundingMetadata) }`.
- `extractGrounding`: guard with `typeof`/`Array.isArray` on `unknown`; no `any`.

- [ ] **Step 4: Register; run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): gemini provider`.

---

### Task 9: Dossier storage

**Files:**
- Create: `server/src/storage/paths.ts`, `server/src/storage/dossiers.ts`
- Test: `server/test/storage/dossiers.test.ts` (uses a temp dir via `fs.mkdtemp`)

**Interfaces:**
- Produces:
  - `slugify(name: string): string` — lowercase, accents folded, non-alphanumerics → `-`, trimmed.
  - `class DossierStore { constructor(dataDir: string) }` with:
    - `list(): Promise<Dossier[]>`
    - `create(input: { company; position; sites; language; provider; model }): Promise<Dossier>` (unique slug with `-2`, `-3` suffix; writes `dossier.json`, empty `offer.md`, `resume.md`, `company.md`, `documents/`, `sessions/`)
    - `read(id): Promise<Dossier>` (throws `NotFoundError`)
    - `update(id, patch: Partial<Dossier>): Promise<Dossier>` (bumps `updatedAt`)
    - `remove(id): Promise<void>`
    - `readText(id, name: 'offer'|'resume'|'company'): Promise<string>` / `writeText(id, name, text)`
    - `readJson<T>(id, name: 'analysis'|'plan', schema: z.ZodType<T>): Promise<T | null>` / `writeJson(id, name, value)`
    - `listDocuments(id): Promise<{ name: string; chars: number }[]>`, `readDocument(id, name)`, `writeDocument(id, name, text)` (name validated `^[\w.-]+\.(md|txt)$`), `removeDocument(id, name)`
  - `class NotFoundError extends Error { status = 404 }`, `class CorruptFileError extends Error { status = 422; constructor(path, cause) }`.

- [ ] **Step 1: Write the failing tests** — create in temp dir, list returns it, slug uniqueness (`Acme` twice → `acme`, `acme-2`), `readText('offer')` empty then round-trips, `readJson('plan')` null then round-trips, corrupt `dossier.json` → `CorruptFileError`, `remove` deletes the folder, document name `../x.md` rejected.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** with `node:fs/promises` (`mkdir` recursive, `readFile`, `writeFile` utf-8, `rm` recursive, `readdir`). Every JSON read goes through the zod schema; a parse failure throws `CorruptFileError(filePath, issues)`. `create` sets `createdAt = updatedAt = new Date().toISOString()`.

- [ ] **Step 4: Run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): dossier storage`.

---

### Task 10: Session storage

**Files:**
- Create: `server/src/storage/sessions.ts`
- Test: `server/test/storage/sessions.test.ts`

**Interfaces:**
- Produces: `class SessionStore { constructor(dataDir: string) }` with `list(dossierId): Promise<Session[]>` (newest first), `create(dossier: Dossier): Promise<Session>` (id = ISO timestamp with `:` and `.` replaced by `-`), `read(dossierId, sessionId): Promise<Session>`, `save(session: Session): Promise<void>`.

- [ ] **Step 1: Failing tests** — create then read equals; list sorted newest first; save appends messages and debrief persists; unknown id → `NotFoundError`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** over `data/<id>/sessions/<sid>.json`, validated with `SessionSchema`.
- [ ] **Step 4: Run tests → PASS. FILEMAP.md. Commit** `feat(server): session storage`.

---

### Task 11: Dossier routes

**Files:**
- Create: `server/src/routes/dossiers.ts`, `server/src/routes/providers.ts`
- Modify: `server/src/app.ts` (mount routes, inject stores; add error handler mapping `status` on errors to HTTP codes; zod errors → 400)
- Test: `server/test/routes/dossiers.test.ts`

**Interfaces:**
- `AppDeps` becomes `{ config; providers: ProviderMap; dossiers: DossierStore; sessions: SessionStore }`. `index.ts` builds the stores from `config.dataDir`.
- Routes:
  - `GET /api/providers` → `[{ id, models }]` for configured providers.
  - `GET /api/dossiers` → `Dossier[]`
  - `POST /api/dossiers` body `{ company, position, sites, language, provider, model }` → 201 `Dossier`
  - `GET /api/dossiers/:id` → `{ dossier, offer, resume, company, documents, analysis, plan }`
  - `PATCH /api/dossiers/:id` → `Dossier`
  - `DELETE /api/dossiers/:id` → 204
  - `PUT /api/dossiers/:id/offer` / `resume` / `company` body `{ text }` → 204
  - `PUT /api/dossiers/:id/plan` body `Plan` (validated) → 204
  - `POST /api/dossiers/:id/documents` body `{ name, text }` → 201; `DELETE /api/dossiers/:id/documents/:name` → 204

- [ ] **Step 1: Failing tests** with `app.request(...)` and a temp `dataDir`: create → 201 with slug; get → aggregate shape; put offer then get shows text; unknown id → 404; invalid body → 400; providers lists a `FakeProvider` registered under `gemini`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (`routes/dossiers.ts` ≤ 150 LOC; use `c.req.json()` + zod `safeParse`; on failure `c.json({ error: issues }, 400)`). Error handler in `app.ts`:
```ts
app.onError((error, c) => {
  const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500
  return c.json({ error: error.message }, status as 400 | 404 | 422 | 500 | 502)
})
```
- [ ] **Step 4: Run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): dossier and provider routes`.

---

### Task 12: Company research pipeline

**Files:**
- Create: `server/src/domain/sections.ts`, `server/src/pipeline/research.ts`, `server/src/routes/prepare.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/pipeline/research.test.ts`, `server/test/domain/sections.test.ts`

**Interfaces:**
- `sections.ts`: `SECTION_IDS = ['sector','products','revenue','headcount','sites','certifications','news','culture','competitors'] as const`, `SectionId`, `SECTION_TITLES: Record<SectionId, { fr: string; en: string }>`, `buildQuery(section: SectionId, dossier: Dossier, knownSector: string | null, language: Language): string` — an instruction such as: `Research "<company>" (sites: <sites>). Report ONLY <section description>. Answer in <language>, 5 to 15 lines of Markdown, no heading. Never invent a figure: if a fact is not found in a source, write "<not found sentence in language>".`
- `research.ts`: `parseCompany(markdown: string): Map<SectionId, string>` (splits on `## <title>` headings, both languages), `renderCompany(sections: ReadonlyMap<SectionId, string>, language): string` (fixed order, `## Title\n\n<text>\n\nSources:\n- url` — sources are part of the stored text), `researchSection(provider, dossier, section, current: string): Promise<string>` → returns the new full `company.md`; `researchAll(provider, dossier, onSection: (id: SectionId) => void): Promise<string>` runs sections sequentially, feeding the found `sector` text into later queries.
- Routes: `POST /api/dossiers/:id/company/research` (all; returns `{ company }`), `POST /api/dossiers/:id/company/research/:section` (one). Provider chosen from `dossier.provider`; missing → 400 `{ error: 'Missing key: ANTHROPIC_API_KEY' }` style message (`keyNameFor(providerId)`).

- [ ] **Step 1: Failing tests** — `buildQuery('revenue', dossier, 'lifting', 'fr')` contains the company name and the French not-found sentence; `parseCompany(renderCompany(map))` round-trips; `researchSection` with `FakeProvider({ search: { text: 'Ropes.', sources: ['https://a'] } })` returns markdown containing `## Produits et services`, `Ropes.` and `- https://a`, and leaves other sections untouched; route test: POST one section → 200 and `company.md` updated on disk.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (`research.ts` ≤ 150 LOC, functions ≤ 40 LOC).
- [ ] **Step 4: Run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): company research`.

---

### Task 13: Offer-vs-resume analysis

**Files:**
- Create: `server/src/pipeline/analysis.ts`
- Modify: `server/src/routes/prepare.ts`
- Test: `server/test/pipeline/analysis.test.ts`

**Interfaces:**
- `analyze(provider: Provider, model: string, offer: string, resume: string, language: Language, signal): Promise<Analysis>` — calls `provider.structured` with `AnalysisSchema`, system prompt (English) instructing: extract each responsibility/requirement verbatim in offer order; `keywords` = the 2-4 words the offer emphasises; `status` per definitions (covered: explicit matching experience; partial: adjacent or unproven; missing: nothing in the resume); `evidence` in `<language>`, one sentence, quoting the resume when covered; `summary` = three sentences in `<language>`. Throws `ProviderError('Offer or resume is empty', 400)` if either text has < 50 characters.
- Route: `POST /api/dossiers/:id/analysis` → `Analysis` (also written to `analysis.json`).

- [ ] **Step 1: Failing tests** — empty offer → rejects with status 400; with `FakeProvider({ structured: <valid analysis> })` returns it and the prompt passed to the provider contains both texts; route writes `analysis.json`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests → PASS. FILEMAP.md. Commit** `feat(server): offer vs resume analysis`.

---

### Task 14: Plan generation

**Files:**
- Create: `server/src/pipeline/plan.ts`
- Modify: `server/src/routes/prepare.ts`
- Test: `server/test/pipeline/plan.test.ts`

**Interfaces:**
- `generatePlan(input: { provider; model; dossier; offer; resume; company; analysis: Analysis | null; signal }): Promise<Plan>`:
  1. Builds the phase list: `SKELETON`, plus `LANGUAGE_SWITCH` inserted before `questions` when `needsLanguageSwitch(offer)` (regex on `bilingu|bilingual|anglais|english|français|french` — case-insensitive — and the dossier language differs from the detected one; keep it simple: any match inserts the phase).
  2. Calls `provider.structured` with schema `PlanDraftSchema = z.object({ persona: PersonaSchema, phases: z.array(z.object({ id, title, objective, targeting, examples })) })` and a prompt listing each skeleton phase `id`, `questions`, `guidance`, then the offer, resume, company profile, and analysis summary; instructs: keep ids exactly, titles/objective/examples in `<language>`, `targeting` 6-12 keywords in the language of the source texts, 3-4 example questions per phase, persona `role` deduced from the offer (who would run this interview), `name` fictional if unknown, `concerns` = what this person struggles with daily, `tone` in one sentence.
  3. Merges: for each skeleton phase find the draft by id (missing → `ProviderError('Plan draft missing phase <id>')`), set `questions` from skeleton, validate with `PlanSchema`.
- Route: `POST /api/dossiers/:id/plan` → `Plan` (written to `plan.json`).

- [ ] **Step 1: Failing tests** — `needsLanguageSwitch('Bilingual required')` true; with a scripted draft covering all 7 ids the result has 16 questions and skeleton order; with the offer mentioning "bilingue" the result has 8 phases and `language-switch` right before `questions`; missing id → rejects.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (≤ 200 LOC).
- [ ] **Step 4: Run tests → PASS. FILEMAP.md. Commit** `feat(server): plan generation`.

---

### Task 15: Interview system prompt

**Files:**
- Create: `server/src/domain/prompt.ts`
- Test: `server/test/domain/prompt.test.ts`

**Interfaces:**
- `buildInterviewSystem(input: { plan: Plan; turn: number; chunks: readonly ChunkHit[]; language: Language; company: string; position: string; candidate: string }): string`. Sections, in order (all in English, generic port of Cerveau's `entrevue.ts`):
  1. Persona block from `plan.persona` + company + position + candidate name (`candidate` = "the candidate" if unknown).
  2. CONDUCT: one question per turn; react in one or two sentences before asking, reusing a word the candidate used; if the answer is solid dig one level deeper rather than change topic; write as one speaks; no bullet-point recap.
  3. COACHING: only when the candidate really stumbles (vague/off-topic, < 2 sentences, "I don't know", factual error on the company or its domain) step out of role with a block starting `> **Out of role — what I would have liked to hear:**` (2-4 sentences, concrete, grounded in the sources) then resume; never coach on a merely improvable answer.
  4. HONESTY: invent no fact about the company (revenue, headcount, certification, client, salary), no standard number; answer in `<language>` except during `language-switch`; no LaTeX.
  5. `<current-phase>` block with `Question <turn> of <total>. Phase: <title>. Objective: <objective>. Reference questions (inspire, do not copy): - ...` and `ALREADY COVERED — do not ask again: <closed titles>` when any; or, when `phaseForTurn` is null, the `<debrief>` block: leave the role for good; per phase what worked, what was missing, the one thing to fix; end with three ranked priorities; be frank.
  6. `<sources>` block: each chunk as `<source id="…" title="…" kind="…">body</source>`, or `No relevant source.`; followed by the sentence that sources anchor questions and coaching and must not be cited like a documentation assistant.

- [ ] **Step 1: Failing tests** — turn 1 output contains persona name, `Question 1 of 6`, phase title, no "ALREADY COVERED"; turn 4 contains `ALREADY COVERED` with the first phase title; turn 7 contains `<debrief>` and not `<current-phase>`; chunks appear as `<source id="offer"`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (≤ 200 LOC; each section a ≤ 40-LOC function returning a string).
- [ ] **Step 4: Run tests → PASS. FILEMAP.md. Commit** `feat(server): interview system prompt`.

---

### Task 16: Chunks and the interview turn

**Files:**
- Create: `server/src/pipeline/chunks.ts`, `server/src/pipeline/interview.ts`
- Test: `server/test/pipeline/interview.test.ts`

**Interfaces:**
- `buildChunks(input: { offer: string; resume: string; company: string; documents: readonly { name: string; text: string }[]; analysis: Analysis | null }): Chunk[]` — one chunk for offer (`id: 'offer'`), resume, one per company section (`id: 'company/<section>'`, title = section title), one per document (`id: 'document/<name>'`), one per requirement (`id: 'requirement/<index>'`, title = `Requirement <index> (<status>)`, body = text + evidence).
- `runTurn(deps: { dossiers: DossierStore; sessions: SessionStore; providers: ProviderMap }, input: { dossierId; sessionId; userText; signal }, callbacks: { onStage(stage: 'retrieving'|'thinking'|'debrief'): void; onSources(ids: string[]): void; onDelta(delta: string): void }): Promise<Session>`:
  1. Load dossier, session, plan (`plan.json` missing → `ProviderError('Generate the plan first', 409)`), provider (missing → 400 missing key).
  2. `turn = turnFromHistory(session.messages)`; `phase = phaseForTurn(plan, turn)`; stage `'debrief'` if null else `'retrieving'`.
  3. Query = `userText + ' ' + phase.targeting.join(' ')` (plain `userText` in debrief); `hits = selectChunks(buildChunks(...), query)`; `onSources(hits ids)`.
  4. System = `buildInterviewSystem(...)`; messages = `session.messages + { user: userText }`; stage `'thinking'`; stream with temperature 0.85, accumulate deltas, forward each.
  5. Append user + assistant messages (`sources` on assistant); if debrief turn, set `session.debrief = text`; `sessions.save`; return session.
- First turn convention: the UI sends `userText = '(start)'`-like opener; the server does not special-case it — the recruiter reacts to whatever comes. Document this in the prompt CONDUCT: "If the candidate has not said anything yet, greet and ask the first question."

- [ ] **Step 1: Failing tests** — `buildChunks` yields expected ids; `runTurn` with FakeProvider and temp stores: stages emitted in order `retrieving`, `thinking`; session saved with 2 messages; the system prompt passed to the provider contains `Question 1 of`; after `totalQuestions` assistant messages, a turn emits stage `debrief` and sets `session.debrief`; missing plan → rejects with 409.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (`interview.ts` ≤ 200 LOC).
- [ ] **Step 4: Run tests → PASS. FILEMAP.md. Commit** `feat(server): interview turn pipeline`.

---

### Task 17: Session routes with SSE

**Files:**
- Create: `server/src/routes/sessions.ts`
- Modify: `server/src/app.ts`
- Test: `server/test/routes/sessions.test.ts`

**Interfaces:**
- `GET /api/dossiers/:id/sessions` → `Session[]`; `POST /api/dossiers/:id/sessions` → 201 `Session`; `GET /api/dossiers/:id/sessions/:sid` → `Session`.
- `POST /api/dossiers/:id/sessions/:sid/turn` body `{ text }` → `text/event-stream` using Hono's `streamSSE`. Events: `stage` (`{ stage }`), `sources` (`{ ids }`), `chunk` (`{ delta }`), `done` (`{ session }`), `error` (`{ message }`). Abort: `c.req.raw.signal` is passed as `signal`.

- [ ] **Step 1: Failing tests** — create session → 201; turn → response `content-type` starts with `text/event-stream`, body text contains `event: stage`, `event: chunk`, `event: done`; a turn on a dossier without plan → body contains `event: error` with the 409 message.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** with `import { streamSSE } from 'hono/streaming'`; wrap `runTurn` in try/catch and write `error` event on failure.
- [ ] **Step 4: Run tests + typecheck → PASS. FILEMAP.md. Commit** `feat(server): session routes with SSE`.

---

### Task 18: Server wrap-up

**Files:**
- Modify: `README.md` (API table, env vars, data layout from spec §4), `FILEMAP.md`
- Create: `LICENSE` (MIT, holder "Pierre Sere"), `CONTRIBUTING.md` (run tests, size limits, no `any`, English code)

- [ ] **Step 1: Smoke run** — `npm run dev --workspace=server` with a real key in `server/.env`; `curl http://localhost:4820/api/providers` returns the configured providers; create a dossier via `curl -X POST ... -H "Content-Type: application/json" -d '{...}'`, put a short offer/resume, run `POST .../analysis` and `POST .../plan` once against the real provider; confirm `analysis.json` and `plan.json` are written and valid. Record any prompt tweak needed in the commit.
- [ ] **Step 2: Run the full suite** — `npm test --workspace=server; npm run typecheck --workspace=server` → PASS.
- [ ] **Step 3: Commit** `docs: server README, license, contributing`.

Continue with `docs/superpowers/plans/2026-08-31-preptalk-web.md`.
