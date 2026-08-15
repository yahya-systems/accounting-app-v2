# Frontend Project Overview (current)

**Status: v1 complete.** Full CRUD across accounts, journals, and journal lines; every list has filtering; every entry is editable via a universal popup; account/journal creation, editing, and deactivation all wired; a global cross-journal ledger view exists. Remaining gaps are known and intentional (see "Not implemented" below), not oversights.

React 19 + Vite, plain JS, folder-per-route pages under `src/pages/`. French UI throughout.

## Design system
- Global `.button` class (`src/index.css`) is the single source of truth for every button in the app: light grey background (`--gray-100`), dark grey text (`--gray-700`), no border, `border-radius: 6px`, subtle hover to `--gray-300`, `:active` → `opacity: 0.5`, `:disabled` → `opacity: 0.4` + `pointer-events: none`. Changing this one rule reskins every button app-wide.
- Color palette in `:root`: `--black`, `--gray-900/700/500/300/100`, `--white`. No dark mode.
- Icon-style buttons (32×32px, centered `+` glyph, no text) are the established pattern for compact create actions living next to a page title: `.home-create-journal`, `.journal-lines-create`, `.account-picker-create`. Full-text buttons ("Créer un compte", "Modifier le journal", etc.) are used everywhere create/edit isn't squeezed into a tight header.
- Home's sidebar is a flex column: scrollable journal list on top, nav buttons ("Comptes", "Écritures") pinned full-width at the bottom — this pattern (scroll region + pinned footer actions) is the reference for any future sidebar-style layout.

## Pages
- `/` (Home) — journal list sidebar + selected journal's lines table. "Créer un journal" popup (name+description). Clicking a line opens the universal `JournalLineDetailPopup`. "En savoir plus" navigates to `/journals/:id`.
- `/accounts` — accounts table with balances (fetched per-row via `getAccountBalance`), `FilterBar` (id prefix, name substring, is_active, created_after/before). "Créer un compte" popup. Row click navigates to `/accounts/:id`.
- `/accounts/:id` — account info (name/id/description/metadata display), "Modifier le compte" popup (name/description/metadata — metadata edit tracks removed original keys and sends explicit `null` to delete, since PATCH shallow-merges), "Désactiver le compte" (confirm popup, `PATCH {is_active:false}`). Journal-lines table with `FilterBar` (from/to/journal-dropdown/type/description). Row click opens `JournalLineDetailPopup`.
- `/journals/:id` — compact single-line info header (name/id/description/created_at/status inline), "Modifier le journal" (name/description only), "Désactiver le journal" (confirm popup). Journal-lines table (date/PCG-number/account-name/debit/credit — PCG number is just `account.id` since account ids are the padded PCG code) with `FilterBar` (from/to/account-prefix/type/description) plus a separate "Créer une écriture" button (`CreateJournalLinePopup` with `journalId` fixed). Row click opens `JournalLineDetailPopup`.
- `/journal-lines` — global flat view across every journal, via the flat `GET /journal-lines` endpoint (both `account` and `journal` embedded). Table: date/account-id/account-name/journal-name/debit/credit. `FilterBar` (from/to/account-prefix/type/description). "+" icon button opens `CreateJournalLinePopup` *without* `journalId` — shows a journal `<select>` dropdown instead (populated from `getJournals()`) so the user picks which journal the line belongs to. Row click opens `JournalLineDetailPopup`. Reachable via a "Écritures" nav button in Home's sidebar (bottom-pinned, next to "Comptes").

## Shared components (`src/components/`)
- `Table.jsx` — generic sortable table, `columns` config (`key,label,sortable,align,width,render`), `onRowClick`, auto filler rows to fill container height.
- `Popup.jsx` — generic modal shell (overlay, Esc/click-outside dismiss, optional title). Content is fully custom children.
- `FilterBar.jsx` — schema-driven filter bar. `schema: [{key,label,type:'date'|'text'|'select',param,options?,placeholder?}]`, owns pending state internally, `onApply(params)` gets a ready query-param object (only non-empty fields, keyed by `param`). Retrofitted onto all three filter bars (Accounts, AccountDetail, JournalDetail) — replaced Accounts' old id-vs-name heuristic search with two plain text fields.
- `JournalLineDetailPopup.jsx` — universal read/edit popup for a single journal line, used from all three tables (Home, AccountDetail, JournalDetail) via row-click → `lineId` state → `<Popup>`. Fetches `GET /journal-lines/:id` (richer embed: account w/ pcg_reference_name, journal {id,name}). Read-only view first + "Modifier" button → edit form (date/description/type-toggle+amount only; account/journal not editable, not PATCHable per spec). PATCHes `date/description/debit_amount/credit_amount`.
- `JournalHeader.jsx` — journal title/description + "En savoir plus" button (Home page only).
- `AccountPickerPopup.jsx` — generic account-selection popup: search (id/name text inputs), table (code+name only, click row → `onSelect(account)` + close). "+" button opens `CreateAccountPopup` nested on top; on creation the new account is prepended to the local list and the inner `Table` is remounted (via a bumped `key` prop) to reset any active sort so the new row shows at the top. Used from `CreateJournalLinePopup`'s account_id field ("Choisir…" button) — selecting an account skips the redundant lookup round-trip since the picker already returns the full account object.
- `CreateJournalLinePopup.jsx` — journal-line creation form (account_id w/ picker+live-lookup, date, description, debit/credit toggle+amount). Promoted from a `/journals/:id`-local component to shared once `/journal-lines` needed it too. Takes an optional `journalId` prop: when provided the journal is fixed (used by `/journals/:id`); when omitted, shows a journal `<select>` dropdown instead (used by `/journal-lines`) populated via `getJournals()`.

**Popup nesting**: `Popup.jsx` maintains a module-level stack of open popups' close handlers so Escape only closes the topmost one, not every open popup at once (their `document` keydown listeners all fire, but only the stack-top's handler actually calls `onClose`). Click-outside works correctly for nesting without extra handling since each popup's overlay is a DOM descendant of the popup that opened it. `CreateAccountPopup.onCreated` now receives the created account object (previously called with no args) so callers like the picker can use it.

## API client (`src/api/client.js`)
All endpoints from the spec are now wrapped: `getJournals/getJournal/createJournal/updateJournal`, `getAccounts/getAccount/createAccount/updateAccount/getAccountBalance/getAccountJournalLines`, `getPcgReference`, `getJournalLines(journalId)/createJournalLine/getJournalLine/updateJournalLine`. `request()` attaches raw server error body as `err.details` (Zod issues array or string) so callers can map field-level errors.

`getAllJournalLines(params)` wraps the flat `GET /journal-lines` (both account+journal embedded, no URL-implied filter), used by `/journal-lines`.

**Not implemented (intentionally, not needed yet):** `DELETE` doesn't exist on the backend for journal-lines at all, so there's no delete anywhere in the UI.

## Patterns established
- Every list/detail page: `pendingParams`(via FilterBar)/`appliedParams` → effect refetch. Every create/edit action: local `refreshKey` state bumped in a callback, included in the fetch effect's dependency array.
- Every create/edit popup: client-side validation first (required fields, format), then submit; server Zod errors mapped via `issue.path[0]` to field-level errors, unmatched issues joined into a general form error banner.
- Metadata (accounts only) edits are diffed: removed *original* keys get explicit `null` (delete), new/edited keys sent normally, since the account PATCH shallow-merges metadata.
- Debit/credit forms always use a single amount field + debit/credit radio toggle client-side, mapped to `debit_amount`/`credit_amount` (`Number(amount)` — must send as number, not string, or Zod rejects it) with the inactive one sent as `null`.
- Live-lookup hints (pcg_code → pcg_reference_name in CreateAccountPopup, account_id → account name in CreateJournalLinePopup) use a debounced effect + a `lookupSeq` ref to guard against stale async responses.

See `mem:api_specification` for the full backend contract.
