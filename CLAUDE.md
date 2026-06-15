# OCB Platform — Claude Code Instructions

## What this is
Credit repair + loan processing + tradelines platform for One Consulting Business.
**Read `docs/PROJECT_BRIEF.md` first** — it is the full spec (brand, features, data model, milestones).

## Stack & conventions
- Next.js 14 App Router, TypeScript strict, Tailwind (brand tokens in `tailwind.config.ts` — never hardcode colors).
- Prisma + PostgreSQL. Schema in `prisma/schema.prisma`. Run `npm run db:push` after schema changes.
- PII (SSN/DOB) must go through `src/lib/crypto.ts` — never store plaintext.
- Every permission check goes through `src/lib/rbac.ts` — never inline role checks.
- Letter generation lives in `src/lib/letters/` — one letter per bureau containing only that bureau's accounts, plus CFPB/FTC/State AG escalations. Tests in `src/lib/letters/__tests__/` must stay green.
- Write vitest tests for all business logic, especially FCRA dispute clocks and CROA billing rules (charge only after `workPerformedAt` is set).

## Milestones (work in order, one branch per milestone)
- **M0 (current)**: auth (Auth.js + MFA for staff), audit-log middleware, CI/CD
- **M1**: CRM — leads/clients CRUD, documents upload (S3), activity timeline
- **M2**: report import GUI wizard + parser, 3-bureau item grid, dispute wizard, letter PDF output
- **M3**: client portal, e-sign, Stripe billing (arrears-compliant)
- **M4**: automations, email/SMS, affiliate portal, reporting → v1 launch
- **M5/M6**: loan processing module, tradelines module (brief §5–6)

## Compliance guardrails (do not break)
- CROA: no charging before work performed; 3-day cancellation in contract flow; no guaranteed-outcome language in any template or UI copy.
- FCRA: 30/45-day reinvestigation clocks drive follow-up automation.
- GLBA: audit log on every PII view; field-level encryption.
