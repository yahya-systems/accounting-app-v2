# Backend Core

Express + TypeScript accounting API, feature-module layout under `src/`.

Modules: `accounts`, `journals`, `journal-lines` — each has `route.ts`, `schema.ts` (zod), `types.ts`, `service/*.ts` (one function per file, verb-first filenames e.g. `create-account.ts`).

Cross-cutting: `src/middleware/error/` (AppError + errorHandler), `src/db/pool.ts` (pg Pool + `query<T>()` helper), `src/index.ts` (app wiring/entry).

`pcg-reference` is a single lookup endpoint (`GET /api/pcg-reference/:code`) defined inline in `index.ts` — intentionally not a feature folder (see `src/db/pcg-reference.sql`).

See `mem:tech_stack`, `mem:conventions`, `mem:suggested_commands`, `mem:task_completion` for details.
