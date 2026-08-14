# Conventions

- Route handlers: thin — parse/validate with the module's zod schema, call one service function, respond, `catch (err) { next(err); }`. No logic in routes.
- Services: one exported async function per file in `service/`, named by verb (`create-account.ts` exports `createAccount`). Take plain input types/objects, return domain types from `types.ts`. Raw SQL via `query<T>(sql, params)` from `@db/pool`, parameterized ($1, $2...) — never string-interpolated SQL.
- Errors: throw `new AppError(status, message)` for expected/domain errors (e.g. 404 not found, 409 conflict); let unexpected errors propagate to `errorHandler`, which also auto-handles `ZodError` (400 with `err.issues`) and malformed JSON body (400).
- Validation: zod schemas per module in `schema.ts`, named `<verb><Entity>{Body,Query}Schema` (e.g. `createAccountBodySchema`, `listAccountsQuerySchema`). Route calls `.parse()` directly (throws → caught by errorHandler).
- `rows[0]` from an insert/select is checked for undefined before use (required by `noUncheckedIndexedAccess`) and thrown as an AppError(500,...) if unexpectedly missing rather than assumed present.
- Inline comments are used to explain *why* for non-obvious business logic (e.g. account id padding/slot allocation in `create-account.ts`, CORS-only-in-dev in `index.ts`) — follow this pattern for similarly non-obvious logic.
- `.DS_Store` files are present throughout (macOS/Darwin dev machine) — ignore them, not part of the project.
