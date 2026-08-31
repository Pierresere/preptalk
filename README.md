# PrepTalk

PrepTalk is an open-source, local-first interview-preparation app. You import a
job offer, your resume, and any supporting documents; it researches the
company, compares the offer against your resume to spot gaps, generates a
tailored interview plan with a recruiter persona, and then runs a simulated
interview — with live coaching and a debrief at the end — against the AI
provider of your choice, using your own API key.

The server (`server/`) is complete and usable via its HTTP API. The web UI
(`web/`) is under construction.

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
