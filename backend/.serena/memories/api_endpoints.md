# API Endpoints (current, post-transactions-refactor)

Base path for all routes: `/api`. Dates in request bodies are `MM-DD` (year implied
as current server year); dates in responses are full `YYYY-MM-DD`.

## /transactions — the atomicity-guaranteeing core (NEW module)

Transactions group journal-lines and enforce debit=credit before anything reaches
the real ledger. `journal_line_drafts` holds unposted lines; `journal_lines` holds
posted ones. A transaction is always editable (date/journal_id/name), even after
posting — no immutability lock on posted transactions themselves (only their
*lines* are locked once posted, since posted lines can only be edited by replacing
the whole set — that replace-flow is NOT built yet, see Known Gaps below).

- `GET /transactions` — filters: `journal_id`, `status` (draft|posted), `name`
  (partial, ILIKE), `from`/`to` (full YYYY-MM-DD range on date), `created_after`/
  `created_before`. Returns list with embedded `journal: {id, name}`.
- `POST /transactions` — body `{journal_id, date (MM-DD), name}`. 404 if journal_id
  doesn't exist, 409 if name not unique. status defaults 'draft'.
- `GET /transactions/:id` — full transaction + `lines: TransactionLine[]`, sourced
  from `journal_line_drafts` if draft, `journal_lines` if posted. Each line has
  joined `account: {id, name}`. 404 if not found.
- `PATCH /transactions/:id` — body `{journal_id?, date?, name?}`, all optional,
  omitted = untouched. journal_id validated to exist AND be active (409 if
  inactive). name uniqueness excludes self. No status gate — works on posted too.
- `DELETE /transactions/:id` — 404 if not found, 409 if status='posted'. Cascades
  to journal_line_drafts automatically (ON DELETE CASCADE).
- `POST /transactions/:id/lines` — add a line-draft. Body `{account_id, description?,
  debit_amount?, credit_amount?}`. debit/credit: omitted/null/0 all mean "not set";
  negative rejected; exactly one must end up positive (XOR) or 400. 404 if
  transaction or account_id doesn't exist. 409 if transaction is posted.
- `PATCH /transactions/:id/lines/:lineId` — edit a line-draft. account_id/description
  independently optional (omitted = untouched). debit_amount/credit_amount are a
  PAIR: if EITHER key is present in the raw request body, BOTH are replaced
  (untouched side becomes null/0), and the XOR check re-applies to the new pair —
  both omitted from body = leave existing amounts alone entirely. 404/409 same as
  POST lines.
- `DELETE /transactions/:id/lines/:lineId` — 404 if line or transaction not found,
  409 if transaction posted, 204 on success.
- `GET /transactions/:id/balance` — `{total_debit, total_credit, sold}` (debit -
  credit). Works regardless of status, sourced from the right table.
- `POST /transactions/:id/post` — THE atomic flush. Inside one DB transaction
  (`withTransaction`, row-locked via `FOR UPDATE`): re-verifies balance (409 if
  unbalanced or zero lines — this is the authoritative check, not just an
  API-layer pre-check), inserts all draft lines into `journal_lines` (description
  becomes `"{transaction.name} : {line.description}"` or just `"{transaction.name}"`
  if line has none), deletes the draft lines, sets status='posted' + posted_at=now().
  404 if not found, 409 if already posted.

## /journal-lines — READ-ONLY now (write endpoints deleted)

`journal_lines` no longer has `journal_id`/`date` columns (migration — see
`mem:core` schema notes). All reads join through `transactions` to recover them.
Every line response now also includes `transaction: {id, name}`.

- `GET /journal-lines` — filters: `from`/`to` (date range via transactions.date),
  `account_id` (prefix match), `journal_id` (via transactions.journal_id), `type`
  (debit|credit), `description` (ILIKE). This is the cross-cutting flat ledger view
  — conceptually a report/projection over transactions, kept because it's the only
  way to query lines across transactions/journals in one shot.
- `GET /journal-lines/:id` — single line, includes `account.pcg_reference_name`
  (looked up via prefix-matching against `pcg_reference`) and `transaction`.
- ~~`POST /journal-lines`~~ — DELETED. Bypassed transaction atomicity; creating a
  bare line outside a transaction is no longer possible.
- ~~`PATCH /journal-lines/:id`~~ — DELETED. Editing now only happens via
  `PATCH /transactions/:id` (transaction-level fields) or the not-yet-built
  posted-lines-replace-atomically flow (see Known Gaps).

## /journals/:id/journal-lines and /journals/:id/balance — KEPT, repaired

Deliberately kept despite `/transactions?journal_id=X` existing, because neither
transaction-level endpoint can filter by `account_id` or line-level `description`
— those only live on `journal_lines`. Both now join through `transactions` for
date/journal_id (same fix pattern as the module above).

- `GET /journals/:id/journal-lines` — filters: `from`/`to`, `account_id`, `type`,
  `description`. Each line includes `account` and `transaction`.
- `GET /journals/:id/balance` — filters: `from`/`to`. Returns
  `{total_debit, total_credit, solde}`.

(`/journals/:id/transactions` as a nested route was discussed and deliberately
NOT built — `GET /transactions?journal_id=X` already covers it.)

## /accounts/:id/journal-lines and /accounts/:id/balance — KEPT, repaired

Kept because there is no `accounts/:id/transactions` equivalent possible — a
transaction spans multiple accounts across its lines, so this is the only way to
see one account's activity. Same join-through-transactions fix applied.

- `GET /accounts/:id/journal-lines` — filters: `from`/`to`, `journal_id`, `type`,
  `description`. Each line includes `journal` and `transaction`.
- `GET /accounts/:id/balance` — filters: `from`/`to`. Returns
  `{balance, total_debit, total_credit, line_count}`.

## Known gaps / deliberately deferred

- No atomic "replace all lines on a posted transaction" endpoint yet (discussed as
  the eventual real PATCH-with-lines-body flow for editing posted transactions
  without ever letting them go unbalanced mid-edit). Until built, posted
  transactions' lines are effectively frozen even though the transaction record
  itself (date/journal/name) stays editable.
- `/accounts` module has pre-existing issues unrelated to this refactor (e.g.
  `POST /accounts` requires a `pcg_code` field not obvious from the account
  creation flow) — not touched, out of scope.
