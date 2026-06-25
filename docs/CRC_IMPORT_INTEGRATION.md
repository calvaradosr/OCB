# CreditRepairCloud report import — integration plan

**Status:** parser built + verified (2026-06-23); UI wiring TODO.

## What already exists
- `src/lib/bureau-crc.ts`
  - `parseCreditRepairCloudReport(page)` → `{ accounts: ParsedAccount[], scores: ParsedScores }`
  - `extractCrcReport(page)` (DOM → raw) + `normalizeCrcExtract(raw)` (pure, unit-tested)
- `src/lib/__tests__/bureau-crc.test.ts` — 6 cases (classification, `--` presence, score column order)
- `scripts/tune-crc.ts` — offline harness: `npx tsx scripts/tune-crc.ts <file.html>`
- Verified against a real CRC export: 15 accounts, scores TU592/EXP606/EQ629, 5 Collection/Chargeoff flagged.

## Key reuse insight
`persistReport()` in `src/app/api/bureau/fetch/route.ts` already takes exactly
`(clientId, service, accounts: ParsedAccount[], scores: ParsedScores)` and writes a
`CreditReport` + items. The CRC parser emits that exact shape — so import is mostly plumbing.

## Steps
1. **Make `persistReport` reusable.** It's currently a private fn in the fetch route. Extract it
   to `src/lib/report-persist.ts` (or export it) so the upload path can call it too. (Touches an
   existing file — needs Documents write access.)
2. **Bureau source.** Add a `CREDIT_REPAIR_CLOUD` value to the `BureauService` enum
   (`prisma/schema.prisma`) + `sourceMap` in persistReport, then `npm run db:push`. (CROA/GLBA:
   no new PII fields, so no encryption change.)
3. **Upload endpoint.** New route `POST /api/reports/import-crc` (Node runtime): accepts an
   uploaded `.html`, launches Playwright, `page.setContent(html)`, runs
   `parseCreditRepairCloudReport`, then `persistReport(clientId, "CREDIT_REPAIR_CLOUD", accounts, scores)`.
   Reuse the `runtime="nodejs"` + `maxDuration` pattern from the fetch route. Guard with RBAC
   (`src/lib/rbac.ts`) + orgId scoping like every other client write.
4. **Wizard UI.** In the M2 import wizard, add a "Paste/upload CreditRepairCloud report" option
   alongside the existing import. On success show the parsed 3-bureau grid for confirmation
   before persisting (mirrors CRC's review step).
5. **GLBA.** Audit-log the import (PII view/create). Do NOT persist the raw HTML; only the parsed
   structured data.

## Gotchas carried from the parser work
- Production (Next build) needs no `__name` shim; that's only for the tsx harness.
- Column order is read from the report's bureau-logo header, not assumed — keep it that way.
- `parseScores` (live scraper) and `extractScore` (bureau-parse) still duplicate the 300–850
  match across the page.evaluate boundary; unrelated to CRC but noted.
