# Backend API Specification (v2)

Source: api-specification.md. All endpoints prefixed `/api`, JSON bodies. Errors: `{ "error": "<message or Zod issues array>" }`. Status codes: 400 malformed/validation, 404 not found, 409 duplicate name, 500 server error.

## Accounts
- `id` is a **string**, always 10-digit zero-padded PCGE code (e.g. `"4481000000"`) — never treat as number.
- `GET /api/accounts` — filters: `id` (prefix), `name` (substring, ci), `is_active`, `created_after`, `created_before`. Returns array of `{id, name, description, is_active, created_at, metadata}`.
- `POST /api/accounts` — body `{pcg_code, name, description?, metadata?}`. `pcg_code`: 1-10 digits, right-padded to 10 by server; auto-finds next free sub-account slot on collision (never 409s for this). `name` must be globally unique (409 if taken).
- `GET /api/accounts/:id` — `:id` must already be full padded 10-digit id (no re-padding on lookup). Adds `pcg_reference_name` to response. 404 if not found.
- `PATCH /api/accounts/:id` — all fields optional. `metadata` is **shallow-merged**: key→value sets/overwrites, key→null deletes that key, omitted keys untouched. `name` 409s on collision.
- `GET /api/accounts/:id/journal-lines` — filters: `from`, `to`, `journal_id`, `type` (debit/credit), `description`. Returns lines with embedded `journal` (not `account`, since that's implied by URL).
- `GET /api/accounts/:id/balance` — filters `from`/`to`. Returns `{balance, total_debit, total_credit, line_count}`.

## Journals
- `id` is a plain **number**.
- `GET /api/journals` — filters: `name`, `description` (substring), `is_active`, `created_after`, `created_before`.
- `POST /api/journals` — body `{name, description?}`. `name` unique (409).
- `GET /api/journals/:id` — 400 if `:id` not valid positive int, 404 if valid but missing.
- `PATCH /api/journals/:id` — optional `{name, description, is_active}`. Same id validation.
- `GET /api/journals/:id/journal-lines` — filters: `from`, `to`, `account_id` (**prefix** match), `type`, `description`. Returns lines with embedded `account` (not `journal`).
- **No balance endpoint for journals** (not a meaningful financial position).

## Journal Lines
No "entry" grouping entity — a compound entry is just several lines sharing date+journal. **Balance is not enforced at write time.**
- `GET /api/journal-lines` — filters: `from`, `to`, `account_id` (prefix), `journal_id`, `type`, `description`. Returns lines with **both** `account` and `journal` embedded (neither implied by URL).
- `GET /api/journal-lines/:id` — richer embed: `account` includes `pcg_reference_name`, `journal` is `{id, name}`. 400/404 on invalid/missing id.
- `POST /api/journal-lines` — body `{journal_id, account_id, date, description, debit_amount, credit_amount}`. `account_id` must be **already fully padded** (no auto-pad here, unlike account creation). `journal_id`/`account_id` 404 if missing. Exactly one of debit/credit must be positive nonzero; other must be null/omitted (both-set, both-null, or either-zero → 400).
- `PATCH /api/journal-lines/:id` — all optional. debit/credit: **provide both or omit both** (providing just one → 400); if both provided, same exactly-one-positive rule as POST.
- No DELETE endpoint for journal lines. Editing a line under an inactive journal is currently allowed (unrestricted, not yet decided).

## Reference Data
- `GET /api/pcg-reference/:code` — exact match only, no prefix/fuzzy. Returns `{id, name}`. 404 if no exact match.

## Critical frontend gotchas
- **Account ids are always strings, zero-padded to 10 digits** — never coerce to number, never strip leading zeros.
- **Journal/journal-line ids are numbers** — invalid values cleanly 400, not crash.
- **`debit_amount`/`credit_amount` are returned as strings** (Postgres numeric, e.g. `"63000.00"`) — must parse before arithmetic. (Matches existing `formatAmount()` util in `src/utils/format.js`, which already expects string input.)
- No trial balance endpoint yet — only per-account balance.
- No auth, no multi-tenancy yet.

## Cross-check against current frontend (see `mem:project_overview`)
- `src/api/client.js` currently only implements `getJournals`, `getAccounts`, `getJournalLines(journalId)` — missing wrappers for: single account/journal fetch, account balance, account journal-lines, journal single-fetch, all journal-lines endpoint, journal-line CRUD (POST/PATCH), PATCH for accounts/journals, pcg-reference lookup.
- `getAccounts()` in client.js takes no params currently used anywhere — `Accounts.jsx` page is still a stub despite the API being ready.
