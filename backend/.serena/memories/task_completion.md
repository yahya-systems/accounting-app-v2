# Task Completion Checklist

No lint/test infra configured yet. Before considering a coding task done:

1. `npm run build` — must pass with zero TS errors (strictness flags in `mem:tech_stack` will catch most mistakes; pay special attention to `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature`).
2. Manually sanity-check new/changed routes follow the thin-route/service pattern in `mem:conventions`.
3. No automated test suite exists — do not claim tests pass; if asked to verify behavior, either write a manual check or ask the user how they'd like to verify.
