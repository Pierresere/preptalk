# Contributing to PrepTalk

Before opening a PR, run and make sure both pass:

```
npm test --workspace=server
npm run typecheck --workspace=server
```

## Coding standards

- TypeScript strict mode; never use `any` (use `unknown` if needed).
- Code and comments in English.
- No `console.log`; no `TODO` without a written justification.
- Size limits:
  - React component: max 200 LOC
  - Custom hook: max 150 LOC
  - Service/utility: max 300 LOC
  - Individual function: max 40 LOC
- Read and understand existing code before modifying it; keep changes minimal
  and targeted.
- Update `FILEMAP.md` when adding or removing files.
