# PrepTalk — Web Implementation Plan (part 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React UI of PrepTalk: dossier list, preparation screen (offer, resume, company profile, analysis, editable plan), streaming interview simulation with phase indicator and coaching, and the debrief screen — FR/EN, light/dark.

**Architecture:** Vite + React 18, one API client module talking to the server from part 1, a tiny hand-written i18n (JSON dictionaries + `useT()`), theme via `data-theme` on `<html>` (port of Cerveau's `theme.ts`), CSS variables only. Screens are routed by a `screen` state in `App` (no router dependency).

**Tech Stack:** React 18, Vite 5, TypeScript strict, Vitest + Testing Library + jsdom.

**Spec:** `E:\App interview\docs\superpowers\specs\2026-08-31-preptalk-design.md` — prerequisite: server plan `2026-08-31-preptalk-server.md` completed (routes and types exist).

## Global Constraints

- TypeScript `strict: true`; **never `any`**.
- Component ≤ 200 LOC, hook ≤ 150, service ≤ 300, function ≤ 40 LOC.
- No `console.log`. CSS variables only (no hardcoded colors/sizes outside `:root`).
- Code, identifiers, comments in English; every user-visible string goes through `t('key')`.
- `FILEMAP.md` updated in every task that creates/deletes files.
- Dev: Vite on `5173` proxies `/api` → `http://localhost:4820`.
- Commands from `E:\App interview`; PowerShell syntax (`;` not `&&`).

## File Structure (web)

```
web/package.json, web/tsconfig.json, web/vite.config.ts, web/index.html
web/src/main.tsx
web/src/App.tsx                     screen state, top bar, theme/lang switches
web/src/styles.css                  tokens (:root light / [data-theme=dark]), layout, components
web/src/i18n/fr.json, en.json
web/src/i18n/index.ts               I18nProvider, useT, useLang
web/src/services/theme.ts           readTheme/applyTheme/writeTheme/followSystem
web/src/services/api.ts             typed fetch wrappers for every route
web/src/services/sse.ts             readSse(response, handlers) — parses event stream
web/src/services/markdown.ts        toHtml (safe subset, port of Cerveau MessageList)
web/src/types.ts                    mirrors server domain types (Dossier, Plan, …)
web/src/hooks/useDossiers.ts        list/create/remove
web/src/hooks/useDossier.ts         aggregate load + save text/plan + research/analysis/plan actions
web/src/hooks/useInterview.ts       session, send (SSE), stop, stage, sources
web/src/components/TopBar.tsx
web/src/components/ThemeSwitch.tsx, LangSwitch.tsx
web/src/components/DossierList.tsx, DossierForm.tsx
web/src/components/PrepareScreen.tsx  tabs: offer | resume | company | analysis | plan
web/src/components/TextPanel.tsx      textarea + save (offer/resume)
web/src/components/CompanyPanel.tsx   sections with rerun buttons
web/src/components/AnalysisPanel.tsx  requirements with status chips
web/src/components/PlanEditor.tsx     persona + phases editing
web/src/components/DocumentsPanel.tsx add/remove text documents
web/src/components/InterviewScreen.tsx
web/src/components/PhaseBar.tsx       "Question 4 / 16 · title"
web/src/components/MessageList.tsx    bubbles, coaching block styling
web/src/components/Composer.tsx
web/src/components/SourcesPanel.tsx
web/src/components/DebriefScreen.tsx
web/test/**                          Vitest + Testing Library
```

---

### Task W1: Vite scaffold, theme, i18n

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles.css`, `web/src/i18n/fr.json`, `web/src/i18n/en.json`, `web/src/i18n/index.ts`, `web/src/services/theme.ts`, `web/src/components/ThemeSwitch.tsx`, `web/src/components/LangSwitch.tsx`, `web/test/setup.ts`
- Test: `web/test/i18n.test.tsx`, `web/test/theme.test.ts`

**Interfaces:**
- `I18nProvider({ children })`, `useT(): (key: string, vars?: Record<string, string | number>) => string`, `useLang(): [Lang, (l: Lang) => void]` with `Lang = 'fr' | 'en'`; persisted in `localStorage['preptalk.lang']`; missing key returns the key itself.
- `theme.ts`: `Theme = 'auto'|'light'|'dark'`, `readTheme()`, `resolve(theme)`, `applyTheme(theme)` (sets `document.documentElement.dataset.theme` to `light`/`dark`), `writeTheme(theme)`, `followSystem(current: () => Theme): () => void`. Storage key `preptalk.theme`.

- [ ] **Step 1: package.json / configs**

`web/package.json`:
```json
{
  "name": "@preptalk/web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit; vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^5.4.11",
    "vitest": "^3.0.0"
  }
}
```
`web/tsconfig.json`: extends base, `"jsx": "react-jsx"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"lib": ["ES2022","DOM","DOM.Iterable"]`, `"types": ["vitest/globals","@testing-library/jest-dom"]`, `"resolveJsonModule": true`, include `src`, `test`.
`web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4820' } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['test/setup.ts'], include: ['test/**/*.test.{ts,tsx}'] },
})
```
`web/test/setup.ts`: `import '@testing-library/jest-dom/vitest'`.
`web/index.html`: `<div id="root">`, `<script type="module" src="/src/main.tsx">`, and the boot script from Cerveau that reads `localStorage['preptalk.theme']` and sets `data-theme` before first paint (values `light`/`dark`; `auto` → `matchMedia`).

- [ ] **Step 2: Failing tests**

`web/test/i18n.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { I18nProvider, useT } from '../src/i18n'

function Probe() { const t = useT(); return <p>{t('app.name')} {t('missing.key')} {t('phase.counter', { n: 2, total: 16 })}</p> }

it('translates, falls back to key, interpolates', () => {
  render(<I18nProvider><Probe /></I18nProvider>)
  expect(screen.getByText(/PrepTalk missing.key Question 2 \/ 16/)).toBeInTheDocument()
})
```
(Default lang in tests is `fr`; `phase.counter` must be `"Question {n} / {total}"` in both languages.)

`web/test/theme.test.ts`: `applyTheme('dark')` sets `document.documentElement.dataset.theme === 'dark'`; `readTheme()` returns `'auto'` when storage empty; `writeTheme('light')` persists and applies.

- [ ] **Step 3: Implement**

`i18n/index.ts`: `const DICTS = { fr, en } as Record<Lang, Record<string, string>>`; `t` looks up `DICTS[lang][key] ?? key` then replaces `{name}` with vars. Context holds `lang` and setter. Initial dictionaries (add keys as later tasks need them; both files must always have the same keys):
```
app.name, nav.dossiers, nav.prepare, nav.interview, nav.debrief,
theme.auto, theme.light, theme.dark, lang.fr, lang.en,
dossiers.new, dossiers.empty, dossiers.delete, dossiers.confirmDelete,
form.company, form.position, form.sites, form.sitesHint, form.language, form.provider, form.model, form.create, form.cancel,
prepare.offer, prepare.resume, prepare.company, prepare.analysis, prepare.plan, prepare.documents, prepare.save, prepare.saved,
company.researchAll, company.rerun, company.empty, company.sources,
analysis.run, analysis.empty, analysis.covered, analysis.partial, analysis.missing,
plan.generate, plan.empty, plan.persona, plan.phases, plan.questions, plan.objective, plan.examples, plan.targeting, plan.save,
documents.add, documents.name, documents.text, documents.remove,
interview.start, interview.new, interview.stop, interview.placeholder, interview.you, interview.coaching, interview.sources, interview.noSources,
stage.retrieving, stage.thinking, stage.debrief,
phase.counter, phase.debrief,
debrief.empty, debrief.sessions,
error.missingKey, error.generic
```
`theme.ts`: port Cerveau `services/theme.ts` with English names and key `preptalk.theme`.
`styles.css`: port Cerveau's `:root` tokens (rename `sombre` → `dark`, `clair` → `light`), scrollbar rules, base `body`, `.topbar`, `.screen`, `.panel`, `.btn`, `.btn-primary`, `.chip`, `.chip-covered/.chip-partial/.chip-missing` (use `--ok`, `--warn`, `--danger` tokens), `.messages`, `.message-user`, `.message-assistant`, `.bubble`, `.coaching` (left border `--accent`, `--accent-soft` background), `.composer`, `.phasebar`.
`App.tsx` (for now): `I18nProvider` + top bar with app name, `ThemeSwitch`, `LangSwitch`.

- [ ] **Step 4: Run** `npm install; npm test --workspace=web; npm run typecheck --workspace=web` → PASS. `npm run dev --workspace=web` shows the bar in both themes.
- [ ] **Step 5: FILEMAP.md; commit** `feat(web): scaffold, theme, i18n`.

---

### Task W2: Types, API client, SSE reader

**Files:**
- Create: `web/src/types.ts`, `web/src/services/api.ts`, `web/src/services/sse.ts`
- Test: `web/test/sse.test.ts`, `web/test/api.test.ts`

**Interfaces:**
- `types.ts`: plain interfaces identical in shape to the server's `Dossier`, `Persona`, `Phase`, `Plan`, `Requirement`, `Analysis`, `Message`, `Session`, plus `ProviderInfo { id: 'openai'|'anthropic'|'gemini'; models: string[] }`, `DossierBundle { dossier; offer; resume; company; documents: { name; chars }[]; analysis: Analysis | null; plan: Plan | null }`.
- `api.ts`: `class ApiError extends Error { status: number }`; functions: `getProviders()`, `listDossiers()`, `createDossier(input)`, `getDossier(id)`, `deleteDossier(id)`, `putText(id, name: 'offer'|'resume'|'company', text)`, `putPlan(id, plan)`, `addDocument(id, name, text)`, `removeDocument(id, name)`, `researchCompany(id)`, `researchSection(id, section)`, `runAnalysis(id)`, `generatePlan(id)`, `listSessions(id)`, `createSession(id)`, `sendTurn(id, sid, text, signal): Promise<Response>` (returns the raw streaming response). All non-2xx → `ApiError(message from body.error, status)`.
- `sse.ts`: `readSse(response: Response, on: { stage?(s: string): void; sources?(ids: string[]): void; chunk?(delta: string): void; done?(session: Session): void; error?(message: string): void }): Promise<void>` — splits on blank lines, reads `event:` and `data:` lines, `JSON.parse` data.

- [ ] **Step 1: Failing tests** — `readSse` over a `Response` built from a string `"event: stage\ndata: {\"stage\":\"thinking\"}\n\nevent: chunk\ndata: {\"delta\":\"Hi\"}\n\nevent: done\ndata: {\"session\":{...minimal}}\n\n"` calls handlers in order; `api.createDossier` with a mocked `fetch` (`vi.stubGlobal`) posts JSON and throws `ApiError` with status 400 on `{ error: 'bad' }`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (`api.ts` ≤ 150 LOC with a shared `request<T>(path, init)` helper).
- [ ] **Step 4: Tests + typecheck → PASS. FILEMAP.md. Commit** `feat(web): api client and sse reader`.

---

### Task W3: Dossier list and creation

**Files:**
- Create: `web/src/hooks/useDossiers.ts`, `web/src/components/DossierList.tsx`, `web/src/components/DossierForm.tsx`
- Modify: `web/src/App.tsx` (screen state `{ name: 'dossiers' } | { name: 'prepare'|'interview'|'debrief'; id: string }`)
- Test: `web/test/DossierForm.test.tsx`

**Interfaces:**
- `useDossiers(): { dossiers, providers, loading, error, create(input), remove(id), reload() }`.
- `DossierForm({ providers, onSubmit, onCancel })` — fields: company, position, sites (one per line → array), language (fr/en), provider (select from `providers`), model (select from the chosen provider's `models`); disabled submit until company and position are filled; when `providers` is empty shows `error.missingKey` text with the three env var names.
- `DossierList({ dossiers, onOpen, onDelete, onNew })` — cards: company, position, updated date; delete asks `window.confirm(t('dossiers.confirmDelete'))` — NOTE: `confirm` is acceptable here (native, user-initiated), but keep it in one place.

- [ ] **Step 1: Failing test** — renders form with one provider having two models; submit disabled initially; after typing company + position and choosing model, submit calls `onSubmit` with `{ company, position, sites: ['A','B'], language: 'fr', provider: 'gemini', model: 'gemini-3.7-flash' }` when sites textarea has `"A\nB"`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.** `App` renders `DossierList` on the `dossiers` screen and opens `prepare` on card click.
- [ ] **Step 4: Tests + typecheck → PASS. Manual check in dev against the running server. FILEMAP.md. Commit** `feat(web): dossier list and form`.

---

### Task W4: Prepare screen — texts and documents

**Files:**
- Create: `web/src/hooks/useDossier.ts`, `web/src/components/PrepareScreen.tsx`, `web/src/components/TextPanel.tsx`, `web/src/components/DocumentsPanel.tsx`
- Modify: `web/src/App.tsx`
- Test: `web/test/TextPanel.test.tsx`

**Interfaces:**
- `useDossier(id): { bundle: DossierBundle | null; busy: string | null; error: string | null; saveText(name, text); addDocument(name, text); removeDocument(name); researchAll(); researchSection(section); runAnalysis(); generatePlan(); savePlan(plan); reload() }` — `busy` holds the running action key (`'research'`, `'analysis'`, `'plan'`, `'save'`) so buttons disable.
- `PrepareScreen({ id, onInterview })` — sub-tab state `'offer'|'resume'|'company'|'analysis'|'plan'|'documents'`; the top-bar commands for this screen are the sub-tabs.
- `TextPanel({ label, value, onSave, busy })` — textarea, Save button enabled when dirty, shows `prepare.saved` for 2 s after save.
- `DocumentsPanel` — list with remove, form name + textarea (name must end with `.md` or `.txt`, enforced client-side too).

- [ ] **Step 1: Failing test** — `TextPanel` save disabled until text changes; clicking save calls `onSave` with the new text.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (`PrepareScreen` ≤ 200 LOC — only tab switching and composition; panels own their logic).
- [ ] **Step 4: Tests + typecheck → PASS. FILEMAP.md. Commit** `feat(web): prepare screen texts and documents`.

---

### Task W5: Company panel and analysis panel

**Files:**
- Create: `web/src/components/CompanyPanel.tsx`, `web/src/components/AnalysisPanel.tsx`, `web/src/services/markdown.ts`
- Test: `web/test/markdown.test.ts`, `web/test/AnalysisPanel.test.tsx`

**Interfaces:**
- `markdown.ts`: `toHtml(text: string): string` — port of Cerveau `MessageList` renderer: escapes HTML, `**bold**`, `` `code` ``, `#/##/###` headings, `-`/`*` lists, blockquote lines `> ` → `<blockquote>`, bare `https://…` → `<a target="_blank" rel="noopener">`.
- `CompanyPanel({ company: string; busy; onResearchAll; onResearchSection })` — splits on `## ` headings client-side into cards (title + rendered body + a rerun button per card mapping title→section id via the i18n `SECTION_TITLES` list duplicated in `types.ts` as `SECTIONS: { id; fr; en }[]`); empty → `company.empty` + `company.researchAll` button.
- `AnalysisPanel({ analysis: Analysis | null; busy; onRun })` — summary paragraph + list; each requirement row: index, text, chip with status class and label, evidence in muted text.

- [ ] **Step 1: Failing tests** — `toHtml('> **Out of role**')` contains `<blockquote>` and `<strong>`; `toHtml('<b>')` escapes; `AnalysisPanel` renders 3 chips with classes `chip-covered`, `chip-partial`, `chip-missing`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.** Wire both panels into `PrepareScreen` tabs.
- [ ] **Step 4: Tests + typecheck → PASS. FILEMAP.md. Commit** `feat(web): company and analysis panels`.

---

### Task W6: Plan editor

**Files:**
- Create: `web/src/components/PlanEditor.tsx`, `web/src/components/PhaseEditor.tsx`
- Test: `web/test/PlanEditor.test.tsx`

**Interfaces:**
- `PlanEditor({ plan: Plan | null; busy; onGenerate; onSave(plan) })` — persona fields (name, role, concerns, tone), list of `PhaseEditor`, Save button enabled when dirty; total questions shown.
- `PhaseEditor({ phase, onChange(phase) })` — title input, questions number input (min 1), objective textarea, targeting as comma-separated input (split/trim/filter on change), examples textarea one per line.

- [ ] **Step 1: Failing test** — with a 2-phase plan, editing the first phase's questions from 2 to 3 and clicking save calls `onSave` with `questions: 3` and total shown as `Question count 4` → assert the displayed total text updates (`plan.questions` key with `{n}`).
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (`PlanEditor` ≤ 200 LOC, `PhaseEditor` ≤ 120 LOC).
- [ ] **Step 4: Tests + typecheck → PASS. FILEMAP.md. Commit** `feat(web): plan editor`.

---

### Task W7: Interview screen with streaming

**Files:**
- Create: `web/src/hooks/useInterview.ts`, `web/src/components/InterviewScreen.tsx`, `web/src/components/PhaseBar.tsx`, `web/src/components/MessageList.tsx`, `web/src/components/Composer.tsx`, `web/src/components/SourcesPanel.tsx`
- Modify: `web/src/App.tsx`
- Test: `web/test/PhaseBar.test.tsx`, `web/test/MessageList.test.tsx`, `web/test/useInterview.test.tsx`

**Interfaces:**
- `useInterview(dossierId, plan: Plan | null): { session: Session | null; draft: string (streaming assistant text); status: 'idle'|'streaming'|'error'; stage: string; sources: string[]; error: string | null; start(): Promise<void> (creates a session and sends the opener text `t('interview.start')` — e.g. "Bonjour, je suis prêt." / "Hello, I'm ready."); send(text): Promise<void>; stop(): void; newSession(): void }`. Uses `api.sendTurn` + `readSse`; on `done` replaces `session`; on `error` sets status.
- `PhaseBar({ plan, session })` — computes turn = assistant count + 1, phase via a client-side copy of `phaseForTurn` (put it in `web/src/services/phases.ts`, same code as server), shows `phase.counter` with `n`/`total` and the phase title, or `phase.debrief` when past the end.
- `MessageList({ messages, draft, streaming })` — renders each message with `toHtml`; an assistant text containing a line starting with `> **` is rendered with the blockquote getting class `coaching` (post-process: replace `<blockquote>` with `<blockquote class="coaching">`); labels `interview.you` / persona name passed as prop `recruiter`.
- `Composer({ disabled, onSend, onStop, streaming })` — textarea, Enter sends (Shift+Enter newline), Stop button while streaming.
- `SourcesPanel({ ids })` — lists chunk ids in a side column, humanised (`company/products` → `Company · products`).

- [ ] **Step 1: Failing tests** — `PhaseBar` with a 6-question plan and 3 assistant messages shows `Question 4 / 6`; with 6 shows `phase.debrief` text; `MessageList` renders a coaching blockquote with class `coaching`; `useInterview` (renderHook, mocked `api.createSession`/`api.sendTurn` returning a `Response` with an SSE body) ends with `session.messages.length === 2` and `status === 'idle'`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.** `InterviewScreen({ id, plan, persona })` composes PhaseBar + MessageList + Composer + SourcesPanel; when `plan === null` shows a hint to generate the plan and a button back to Prepare. App: nav to `interview` from Prepare's button; `debrief` screen next task.
- [ ] **Step 4: Tests + typecheck → PASS. Manual run with a real provider: complete 3 turns, stop mid-stream works, coaching block renders. FILEMAP.md. Commit** `feat(web): interview screen with streaming`.

---

### Task W8: Debrief screen and sessions list

**Files:**
- Create: `web/src/components/DebriefScreen.tsx`
- Modify: `web/src/App.tsx`, `web/src/components/TopBar.tsx` (nav across the four screens, disabled states when no dossier selected)
- Test: `web/test/DebriefScreen.test.tsx`

**Interfaces:**
- `DebriefScreen({ id })` — loads `api.listSessions(id)`; left column: sessions (date, message count, has-debrief mark); main: selected session's `debrief` rendered with `toHtml`, or `debrief.empty`; a transcript toggle shows the session messages via `MessageList`.

- [ ] **Step 1: Failing test** — with `api.listSessions` mocked to two sessions, the first with a debrief, renders the debrief text and two session rows.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Tests + typecheck → PASS. FILEMAP.md. Commit** `feat(web): debrief screen`.

---

### Task W9: End-to-end pass and release polish

**Files:**
- Modify: `README.md` (screenshots optional, usage walkthrough: create dossier → paste offer/resume → research → analysis → plan → interview → debrief), `FILEMAP.md`, `web/src/styles.css` (mobile: single column under 800 px, composer sticky bottom)

- [ ] **Step 1: Full flow with a real provider** — run `npm run dev` (root) and walk the whole flow with a real offer and resume. Fix any bug found in the same commit series (one commit per fix, message `fix(web|server): …`).
- [ ] **Step 2: `npm start` at the root** — web builds, server serves `web/dist` on 4820, the app works without Vite.
- [ ] **Step 3: Full verification** — `npm test; npm run typecheck` at root → all PASS. Check every component ≤ 200 LOC: `Get-ChildItem web/src -Recurse -Filter *.tsx | ForEach-Object { "$($_.Name) $((Get-Content $_.FullName).Count)" }`.
- [ ] **Step 4: Commit** `docs: usage walkthrough` and tag `v0.1.0`: `git tag v0.1.0`.

---

## Self-review (done at plan-writing time)

- Spec coverage: §3 architecture → T1/W1; §4 data → T9/T10; §5.1 import → T11/W3/W4; §5.2 research → T12/W5; §5.3 analysis → T13/W5; §5.4 plan/persona/language-switch → T14/W6; §5.5 simulation (turn, retrieval, prompt, SSE) → T3/T4/T15/T16/T17/W7; §5.6 debrief → T15/T16/W8; §6 providers → T5–T8; §7 UI four screens, theme, i18n → W1–W8; §8 errors → T11 error handler, T12 missing-key message, T8 structured retry, T9 CorruptFileError, W2 ApiError; §9 tests → each task; §10 constraints → Global Constraints; LICENSE/CONTRIBUTING → T18.
- Type consistency: `Provider.stream` yields deltas (T5) and `runTurn` accumulates (T16); `ChunkHit` from T4 used in T15; `phaseForTurn(plan, turn)` signature identical server (T3) and web (W7); SSE event names identical in T17 and W2.
