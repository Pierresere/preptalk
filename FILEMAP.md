# FILEMAP

- `package.json` — root npm workspaces config, top-level scripts (dev/build/test/typecheck)
- `tsconfig.base.json` — shared strict TypeScript compiler options
- `server/package.json` — server workspace package, scripts and dependencies
- `server/tsconfig.json` — server TypeScript config, extends base
- `server/vitest.config.ts` — vitest test runner config for server
- `server/.env.example` — template for server environment variables (API keys, data dir, port)
- `server/src/config.ts` — `readConfig`: parses `Config` from `process.env`
- `server/src/app.ts` — `createApp`: builds the Hono app, exposes `/api/health`
- `server/src/index.ts` — server entry point: reads config, creates app, serves static web build, listens
- `server/src/domain/types.ts` — zod schemas and TypeScript types for all domain entities (Dossier, Plan, Session, etc.)
- `server/src/domain/skeleton.ts` — `SKELETON` constant with 7 interview phases and `LANGUAGE_SWITCH` phase, with `SkeletonPhase` interface
- `server/src/domain/phases.ts` — phase engine: `turnFromHistory`, `totalQuestions`, `phaseForTurn`, `closedPhases`
- `server/test/app.test.ts` — tests for `createApp` health endpoint and `readConfig` defaults
- `server/test/domain/types.test.ts` — tests for zod schemas and skeleton structure
- `server/test/domain/phases.test.ts` — tests for phase engine functions
- `web/package.json` — placeholder web workspace package (UI not yet implemented)
- `FILEMAP.md` — this file
- `README.md` — project overview and setup instructions
