# Suggested Commands

- Dev server (hot reload): `npm run dev` (tsx watch src/index.ts)
- Build: `npm run build` (tsc && tsc-alias — both required, tsc-alias resolves the `@/*` path aliases in emitted `dist/` JS)
- Run built app: `npm start` (node dist/index.js)
- No lint/format script defined in package.json currently.
- `npm test` is an unconfigured stub (exits 1) — do not rely on it.
- Darwin note: BSD `grep`/`sed` differ from GNU; prefer serena's own search/replace tools (`search_for_pattern`, `replace_content`, `replace_in_files`) over shelling out to grep/sed for portability.
