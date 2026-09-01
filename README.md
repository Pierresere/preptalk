# PrepTalk

PrepTalk is an open-source, local-first interview-preparation app. You import a
job offer, your resume, and any supporting documents; it researches the
company, compares the offer against your resume to spot gaps, generates a
tailored interview plan with a recruiter persona, and then runs a simulated
interview — with live coaching and a debrief at the end — against the AI
provider of your choice, using your own API key.

The server (`server/`) is complete and usable via its HTTP API. The web UI
(`web/`) is included — run `npm start` and open `http://localhost:4820`.

## Quick start

```
npm install
```

Copy `server/.env.example` to `server/.env` and fill in at least one API key
(OpenAI, Anthropic, or Gemini):

```
cp server/.env.example server/.env
```

```
npm run dev
```

The server listens on `http://localhost:4820` by default.

## Usage

A typical session, end to end:

1. **Create a dossier** — click "New" and fill in the company name and
   position. This creates a folder under `data/<slug>/`.
2. **Paste the offer and resume** — open the dossier and paste the job offer
   text and your resume text into their respective panels; add any supporting
   documents (`.md`/`.txt`) you want the plan to draw on.
3. **Research the company** — run company research to fetch/generate the
   company background sections used later to tailor the interview.
4. **Run the analysis** — compare the offer against your resume to see
   covered, partial, and missing requirements.
5. **Generate the plan** — produce a phased interview plan with a recruiter
   persona, based on the analysis and company research.
6. **Edit the plan** — the plan is plain JSON/text; adjust phases, questions,
   or the persona by hand if you want to steer the interview.
7. **Simulate the interview** — start a session and answer the recruiter's
   questions; responses stream in with live coaching notes and source
   citations from your dossier.
8. **Review the debrief** — after the session, read the generated debrief and
   optionally revisit the full transcript.

To run the built app without Vite (`npm start`), the web UI is served
directly by the server on `http://localhost:4820`.

## Environment variables (`server/.env`)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key. Enables the `openai` provider when set. |
| `ANTHROPIC_API_KEY` | Anthropic API key. Enables the `anthropic` provider when set. |
| `GEMINI_API_KEY` | Google Gemini API key. Enables the `gemini` provider when set. |
| `DATA_DIR` | Where dossier folders are stored. Defaults to `../data` (relative to `server/`). |
| `PORT` | HTTP port. Defaults to `4820`. |

At least one provider key must be set; the UI/API only shows providers whose
key is present.

## API routes

All routes are mounted under `/api`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness check. |
| GET | `/api/providers` | List configured providers and their models. |
| GET | `/api/dossiers` | List dossiers. |
| POST | `/api/dossiers` | Create a dossier (writes `dossier.json`, `offer.md`, `resume.md`). |
| GET | `/api/dossiers/:id` | Get a dossier plus its parsed `analysis` and `plan`. |
| PATCH | `/api/dossiers/:id` | Update dossier metadata. |
| DELETE | `/api/dossiers/:id` | Delete a dossier. |
| PUT | `/api/dossiers/:id/offer` | Replace `offer.md`. |
| PUT | `/api/dossiers/:id/resume` | Replace `resume.md`. |
| PUT | `/api/dossiers/:id/company` | Replace `company.md`. |
| PUT | `/api/dossiers/:id/plan` | Replace `plan.json` (manual edits to the plan). |
| POST | `/api/dossiers/:id/documents` | Add a supporting document. |
| DELETE | `/api/dossiers/:id/documents/:name` | Remove a supporting document. |
| POST | `/api/dossiers/:id/company/research` | Run company research for all sections. |
| POST | `/api/dossiers/:id/company/research/:section` | Re-run one company research section. |
| POST | `/api/dossiers/:id/analysis` | Compare offer vs resume, persist `analysis.json`. |
| POST | `/api/dossiers/:id/plan` | Generate the interview plan and persona, persist `plan.json`. |
| GET | `/api/dossiers/:id/sessions` | List interview sessions. |
| POST | `/api/dossiers/:id/sessions` | Create a new interview session. |
| GET | `/api/dossiers/:id/sessions/:sid` | Get one session. |
| POST | `/api/dossiers/:id/sessions/:sid/turn` | Send a candidate turn; streams `stage`/`sources`/`chunk`/`done`/`error` events over SSE. |

## Data layout

Each application is stored as one folder under `data/<slug>/`, where the slug
is derived from the company name (with a numeric suffix on collision). Every
file is plain text/JSON, human-readable and hand-editable; the server rereads
files on each request (no caching in v1).

```
data/<slug>/
  dossier.json     { id, company, position, sites[], language, provider, model,
                     createdAt, updatedAt }
  offer.md         the job offer, as pasted
  resume.md        the resume / list of skills and experience
  company.md        the company research, section by section
  documents/        uploaded files (.md, .txt) — PDF support planned for v2
  analysis.json     the offer-vs-resume analysis (requirements + coverage)
  plan.json         the interview plan (phases) + recruiter persona
  sessions/
    <timestamp>.json  one simulation: messages, turn, debrief, provider used
```

## Development

```
npm test --workspace=server
npm run typecheck --workspace=server
```

See `CONTRIBUTING.md` for coding standards before opening a PR.
