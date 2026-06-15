# One Consulting Business — Platform Project Brief

> **Purpose of this document:** This is the build blueprint for a credit repair, loan processing, and tradelines platform for One Consulting Business (onceconsultingbusiness.com). It is written to be consumed directly by Claude Code as the project brief. Drop it in the repo root (or reference it from CLAUDE.md) and build phase by phase.

**Working name:** OCB Platform
**Owner:** Christopher (VP of Sales & Business Development)
**Target capacity:** ~50 staff/affiliate seats + unlimited client portal logins (start ~300–1,200 active clients)
**Hosting:** AWS

---

## 1. Product Vision

A single platform that does what Credit Repair Cloud does for credit repair — client CRM, credit report analysis, automated dispute management, client/affiliate portals, billing — **plus two modules CRC doesn't have:**

1. **Loan Processing/Consulting** — pipeline management for loan files from intake to funding.
2. **Tradelines** — inventory and order management for authorized-user tradeline sales.

The three lines share one client record: a credit repair client can be cross-sold a tradeline, then graduated into the loan pipeline — all in one profile with one timeline.

**Important:** functionality is inspired by CRC, but all UI, copy, letter templates, and code are original work. Do not copy CRC assets.

---

## 2. Brand Guide

Derived from the One Consulting Business logo (gold ring "one" mark + two-tone gold wordmark).

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#A8862B` | Primary gold — buttons, links, active nav, logo ring tone |
| `--primary-dark` | `#8A6E20` | Hover/pressed states, emphasis |
| `--secondary` | `#DFC172` | Light gold — accents, badges, highlights, "Business" wordmark tone |
| `--secondary-soft` | `#F3E8C8` | Subtle backgrounds, table row highlights, tags |
| `--ink` | `#2B2620` | Primary text (warm near-black) |
| `--muted` | `#7A6F5C` | Secondary text, captions |
| `--bg` | `#FAF8F2` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, panels |
| `--success` | `#3E7C4A` | Dispute won, loan funded |
| `--warning` | `#C77B22` | Pending, awaiting response |
| `--danger` | `#B0382E` | Negative items, overdue, errors |

- **Typography:** Inter (UI) + a serif or rounded display face for marketing pages. Headings semibold.
- **Logo:** white/off-white backgrounds only; maintain clear space equal to the ring height. Provide a one-color dark-gold variant for footers/invoices.
- **Tone:** professional, trust-first, plain-English (clients are often credit-stressed — avoid jargon).

---

## 3. Users & Roles

| Role | Access |
|---|---|
| **Owner/Admin** | Everything incl. billing, settings, user management, all three modules |
| **Manager** | Full client + pipeline access in assigned modules, no org settings |
| **Agent / Dispute Specialist** | Assigned clients, dispute work queue, comms |
| **Loan Processor** | Loan pipeline module, assigned files |
| **Affiliate / Referral Partner** | Portal: submit referrals, see status + commissions only |
| **Client** | Portal: own progress, documents, score tracking, invoices, e-sign, messaging |

Role-based access control (RBAC) is foundational — build it in Phase 1 before any module.

---

## 4. Phase 1 — Credit Repair Core (v1, ship first)

### 4.1 CRM & Lead Management
- Leads: capture via web form/API/manual entry; statuses (New → Contacted → Consult Scheduled → Signed → Active Client); assignment; notes; activity timeline.
- Clients: unified profile — contact info, SSN (encrypted), DOB, addresses, linked documents, billing status, module flags (credit repair / loan / tradeline).
- Pipeline kanban + list views, saved filters, CSV import/export.

### 4.2 Credit Report Import & Audit (GUI-driven)
- **Import wizard (in-app GUI):** staff opens client profile → "Import Report" → enters/stores the client's monitoring-service credentials or triggers the partner API → live progress indicator → parsed results land on a review screen before saving. No CLI, no manual data entry.
- Integrate a consumer credit monitoring provider (SmartCredit, IdentityIQ, or MyFreeScoreNow — these offer partner APIs; client pays ~$20–30/mo subscription directly).
- Parse 3-bureau report into structured data: accounts, inquiries, public records, personal info — displayed in a side-by-side 3-bureau comparison grid.
- Auto-flag derogatory items (collections, charge-offs, late payments, inquiries, repossessions, bankruptcies); staff can review/override flags via checkboxes in the grid.
- Score tracking over time per bureau (chart on client profile + client portal).
- Fallback: manual report upload (PDF/HTML) with parser, and fully manual item entry — same review GUI.

### 4.3 Dispute Engine (the core)
- Dispute wizard: select flagged items in the 3-bureau grid → choose reason + strategy → **letters are generated automatically, one per bureau, each containing only the accounts being disputed at that bureau** (an account disputed at Experian and TransUnion but not Equifax produces two letters with the correct account lists). Furnisher/collector letters generated the same way.
- **Regulatory escalation letters (auto-generated from the same selected accounts):** CFPB complaint letter, FTC complaint/identity-theft letter, and state Attorney General letter. Note: CFPB and FTC accept complaints primarily through their online portals (consumerfinance.gov/complaint, ReportFraud.ftc.gov, IdentityTheft.gov) — the system generates the complaint narrative + account detail ready to paste/submit, plus a mailable PDF version, and tracks submission date and complaint number on the dispute record.
- **Original letter template library** (build ~30–50 to start: initial dispute, reinvestigation, method of verification, goodwill, pay-for-delete, debt validation, identity theft block, inquiry removal, HIPAA-related medical collection, etc.) with merge fields (`{{client.name}}`, `{{item.account_number}}`, `{{bureau.address}}`...).
- Dispute rounds: track sent date, 30/45-day FCRA response clocks with automatic follow-up tasks, outcomes (Deleted / Repaired / Verified / No Response), next-round escalation.
- Letter output: PDF generation; print queue; optional mail API integration (Lob or Click2Mail) for one-click certified mail.

### 4.4 Client Portal
- Progress dashboard: score trend, items disputed/deleted, current round.
- Document upload (ID, proof of address, utility bills) with checklist.
- Secure messaging with assigned agent.
- Invoices/payment methods; agreement e-signing.
- White-labeled with OCB branding; mobile-responsive.

### 4.5 Affiliate Portal
- Referral submission form + unique tracking links.
- Pipeline visibility (status only, no PII beyond name).
- Commission ledger and payout history.

### 4.6 Billing
- Stripe: recurring subscriptions (setup fee + monthly), per-deletion billing option, invoices, dunning/failed-payment retry, payment links.
- **CROA compliance constraint:** fees may only be charged after work is performed — billing engine must support charge-in-arrears scheduling. Telemarketing Sales Rule applies if selling by phone.

### 4.7 Communications & Automation
- Email (SES or SendGrid) + SMS (Twilio) with template library and merge fields.
- Automation engine: trigger → action (e.g., "report imported → send audit email", "30 days no bureau response → create follow-up task", "item deleted → notify client + invoice per-delete fee").
- Drip sequences for leads and active clients.

### 4.8 E-signatures & Documents
- Client agreement, CROA-required disclosures (3-day cancellation notice, contract terms), POA — native signature pad or Documenso/Dropbox Sign integration.
- S3 document storage, per-client folders, encrypted at rest.

### 4.9 Compliance (non-negotiable, build into Phase 1)
- **CROA:** written contract, 3-business-day right to cancel, no advance fees, no guaranteed-outcome claims in templates.
- **FCRA:** dispute timelines, permissible purpose for report access.
- **GLBA Safeguards Rule:** encryption (SSN/DOB field-level AES-256), access logging, audit trail on every record touch.
- State CRO registration/bond tracking field per operating state.
- Full audit log: who viewed/edited what, when.

### 4.10 Reporting
- Dashboard: active clients, items disputed vs deleted, deletion rate, revenue (MRR, collected, past due), agent productivity, affiliate performance.

---

## 5. Phase 2 — Loan Processing Module

- **Loan file pipeline:** Intake → Pre-qual → Docs Collection → Processing → Submitted to Lender → Conditional Approval → Clear to Close → Funded (statuses configurable).
- Loan file: type (personal, business, auto, mortgage, SBA…), amount requested/approved, lender, rate, term, commission.
- **Document checklist engine** per loan type (paystubs, bank statements, tax returns, business financials) with client-portal upload requests and auto-reminders.
- Lender directory: contacts, programs, min credit score, submission notes.
- **Credit-readiness bridge:** flag credit repair clients who hit a target score → auto-create loan lead (this is the cross-sell engine).
- Conditions tracking, funding ledger, processor task queues.

## 6. Phase 3 — Tradelines Module

- **Inventory:** tradeline records — cardholder (vendor), bank, credit limit, age, statement date, available AU spots, cost, retail price.
- **Order flow:** client selects/staff assigns line → payment → AU info packet to vendor → posting verification (does it appear on the report import?) → completion; removal date tracking.
- Posting-success tracking per line/vendor (auto-verify against §4.2 report imports — a differentiator nobody else has).
- Vendor management + payouts; commission tracking.
- Compliance guardrails: disclosure templates, no posting guarantees in client-facing copy.

---

## 7. Architecture & Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | **Next.js 14+ (App Router, TypeScript)** | One codebase, SSR, Claude Code works extremely well in it |
| DB | **PostgreSQL (RDS)** + Prisma ORM | Relational fits this domain; row-level multi-role access |
| Auth | NextAuth/Auth.js or Clerk | RBAC, MFA (required for staff), separate client/affiliate realms |
| Jobs/queues | BullMQ + Redis (ElastiCache or Upstash) | Dispute clocks, drip emails, report polling |
| Files | S3 (+ CloudFront) | Encrypted docs, letters, exports |
| PDF | react-pdf or Puppeteer service | Letters, invoices, audits |
| Email/SMS | SES + Twilio | Cost-effective at this volume |
| Payments | Stripe | Subscriptions + metered per-delete billing |
| Monitoring | Sentry + CloudWatch | |

**Multi-tenancy note:** build single-tenant (OCB only) but keep an `org_id` column on every table from day one — if you ever white-label this to other CROs (a real revenue option), you're ready.

### Core data model (Phase 1)
```
users (role, mfa, status)
clients (pii encrypted, modules[], assigned_agent)
leads → clients
credit_reports (bureau, pulled_at, raw, score)
report_items (type, bureau, status, flagged)
disputes (item_id, round, strategy, letter_id, sent_at, due_at, outcome)
letter_templates / letters (rendered, pdf_url)
documents (s3_key, category, uploaded_by)
invoices / subscriptions / payments (stripe ids)
messages (client ↔ staff)
automations (trigger, conditions, actions)
affiliates / referrals / commissions
audit_log (actor, action, entity, before/after, ip)
-- Phase 2: loan_files, loan_conditions, lenders, loan_docs_checklist
-- Phase 3: tradelines, tradeline_orders, vendors
```

---

## 8. AWS Deployment (50 seats)

| Component | Service | Est./mo |
|---|---|---|
| App | ECS Fargate (2 tasks) or single t3.medium EC2 + Docker | $35–70 |
| DB | RDS Postgres db.t4g.small, Multi-AZ off initially, automated backups | $30–55 |
| Redis | ElastiCache t4g.micro (or Upstash free tier) | $0–15 |
| Load balancer | ALB | $20 |
| Storage/CDN | S3 + CloudFront | $5–15 |
| Email | SES | $5–10 |
| DNS/WAF | Route53 + Cloudflare free | $1 |
| **AWS subtotal** | | **~$100–190** |
| Twilio SMS | usage | $20–60 |
| Stripe | 2.9% + 30¢ per charge | % of revenue |
| Mail API (Lob) | per letter (~$0.80–2.50 certified) | usage |
| Credit monitoring API | client-paid (~$20–30/client/mo) | $0 to you |
| Sentry, domain, misc | | $10–30 |

**Realistic total: $150–300/mo** at 50 seats / a few hundred clients. Scale path: bump RDS, add Fargate tasks behind the ALB — no re-architecture needed below ~10k clients.

CI/CD: GitHub Actions → build Docker image → ECR → ECS deploy. Staging + production environments. Secrets in AWS Secrets Manager.

---

## 9. Build Plan (Claude Code milestones)

1. **M0 (week 1):** repo scaffold, auth + RBAC, brand theme/tokens, CI/CD to staging.
2. **M1 (weeks 2–4):** CRM (leads/clients), documents, audit log.
3. **M2 (weeks 4–7):** report import + parsing, item flagging, dispute engine + letter library, PDF output.
4. **M3 (weeks 7–9):** client portal, e-sign, Stripe billing (arrears-compliant).
5. **M4 (weeks 9–11):** automations, email/SMS, affiliate portal, reporting dashboard. **← v1 launch**
6. **M5:** loan processing module (Phase 2).
7. **M6:** tradelines module (Phase 3).

Each milestone: unit tests on business logic (dispute clocks, billing rules), seed data, and a staging demo before moving on.

### How to run this with Claude Code
- Put this file in the repo; create `CLAUDE.md` pointing to it with stack conventions.
- Work milestone by milestone — one feature branch per module, review diffs before merge.
- Have Claude Code write tests for FCRA timing logic and CROA billing rules first (these are the lawsuit-prevention features).

---

## 10. Open Decisions

1. Which credit monitoring partner (SmartCredit vs IdentityIQ vs MyFreeScoreNow) — affects parser work; pick before M2.
2. Mailing: print in-office vs Lob/Click2Mail automation.
3. E-sign: native pad (free, simpler) vs Dropbox Sign (~$25/mo, audit trail).
4. State coverage list for CRO registration/bonding (affects onboarding copy and contract templates).
5. Domain/subdomain for the app (e.g., `app.oneconsultingbusiness.com`).
