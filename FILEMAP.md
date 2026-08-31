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
- `server/test/app.test.ts` — tests for `createApp` health endpoint and `readConfig` defaults
- `web/package.json` — placeholder web workspace package (UI not yet implemented)
- `FILEMAP.md` — this file
- `README.md` — project overview and setup instructions
