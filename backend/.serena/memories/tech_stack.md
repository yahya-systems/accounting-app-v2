# Tech Stack

- Node/TypeScript backend, `type: commonjs` (NOT ESM) despite modern TS target.
- Express 5, pg (raw SQL via `query<T>()`, no ORM), zod v4 for validation, cors, dotenv.
- Dev runner: `tsx watch`. Build: `tsc && tsc-alias` (path aliases must be resolved post-build via tsc-alias). Prod run: `node dist/index.js`.
- tsconfig path aliases (baseUrl `.`, rootDir `src`): `@/*`, `@db/*`, `@middleware/*`, `@accounts/*`, `@journals/*`, `@journal-lines/*`. Both alias imports and relative imports (`./service/x`) are used interchangeably within the same file — no fixed rule on which to use.
- tsconfig strictness is maximal: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`. Code must satisfy all of these — e.g. `process.env['X']` bracket access (not `process.env.X`) due to noPropertyAccessFromIndexSignature; array/index access is possibly-undefined due to noUncheckedIndexedAccess (see `rows[0]` checks in services).
- DB: PostgreSQL, connection via `DATABASE_URL` env var. Schema in `src/db/schema.sql`, reference data in `src/db/pcg-reference.sql`.
- No test runner configured — `npm test` is a stub that exits 1.
