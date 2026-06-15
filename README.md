# OCB Platform

Credit repair, loan processing & tradelines platform for One Consulting Business.

## Quick start
1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` + `PII_ENCRYPTION_KEY` (`openssl rand -base64 32`)
3. `npm run db:push`
4. `npm run dev` → http://localhost:3000

## Continue building with Claude Code
1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. `cd` into this folder, run `claude`, sign in with your Claude account (Pro plan works — no API fees)
3. Say: *"Read CLAUDE.md and docs/PROJECT_BRIEF.md, then start milestone M0."*
4. Work one milestone at a time; run `npm test` before merging each one.

## What's already built
- Project scaffold (Next.js 14 + TypeScript + Tailwind with OCB gold brand tokens)
- Full Phase 1 Prisma schema (clients, reports, items, disputes, letters, billing, audit log)
- RBAC permission matrix, PII field encryption (AES-256-GCM)
- Letter engine: auto-generates one letter per bureau with only that bureau's accounts + CFPB/FTC/State AG escalation letters — with passing tests
- 5 original letter templates (initial dispute, debt validation, CFPB, FTC identity theft, State AG)
- Branded login + app shell (sidebar, dashboard)
