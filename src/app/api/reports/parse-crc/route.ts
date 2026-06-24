/**
 * POST /api/reports/parse-crc
 *
 * Parses an uploaded CreditRepairCloud HTML report (the export from
 * app.creditrepaircloud.com) into structured report items + bureau scores, and
 * returns them for review. It deliberately does NOT persist anything — the
 * client reviews/edits the parsed grid in the import wizard and commits through
 * the existing importReport() server action, so audit logging, automations, and
 * tradeline checks stay on a single persist path.
 *
 * Parsing reuses @/lib/bureau-crc, which expects a Playwright Page. CRC reports
 * are static HTML, so we load the upload via chromium + page.setContent() (no
 * login, no network) — the same approach as scripts/tune-crc.ts.
 *
 * Auth: session-based (Auth.js) + RBAC "reports:import".
 * GLBA: the upload contains client PII, so the parse is audit-logged as a
 * VIEW_PII of the client. The raw HTML is never written to disk or the DB.
 *
 * Request: multipart/form-data with `file` (the .html) and `clientId`.
 * Response: { items: ImportedItem[], scores: { experian, equifax, transunion } }
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { AUTO_FLAG_TYPES } from "@/lib/report-utils"
import { parseCreditRepairCloudReport } from "@/lib/bureau-crc"
import type { ImportedItem } from "@/app/actions/reports"

// Playwright requires the Node runtime (not Edge); parsing a large report can
// take several seconds while Chromium loads the document.
export const runtime = "nodejs"
export const maxDuration = 60

// Reject obviously-oversized uploads early. A full 3-bureau CRC report is a few
// hundred KB of HTML; 15 MB is a generous ceiling that still bounds memory.
const MAX_BYTES = 15 * 1024 * 1024

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!can(session.user.role, "reports:import")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
  }

  const clientId = form.get("clientId")
  const file = form.get("file")
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing report file" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 413 })
  }

  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } })
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  const html = await file.text()

  let parsed
  try {
    parsed = await parseCrcHtml(html)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Failed to parse report: ${msg.slice(0, 200)}` },
      { status: 422 }
    )
  }

  const items: ImportedItem[] = parsed.accounts.map(acc => ({
    creditorName: acc.creditorName,
    accountNumberMasked: acc.accountNumberMasked,
    type: acc.type,
    onExperian: acc.onExperian,
    onEquifax: acc.onEquifax,
    onTransunion: acc.onTransunion,
    balance: acc.balance,
    dateOpened: acc.dateOpened,
    // The CRC parser maps only the fields ParsedAccount carries; these are left
    // blank for the reviewer to fill in the wizard before committing.
    accountStatus: "",
    chargeOffDate: "",
    lastPaymentDate: "",
    highBalance: "",
    flagged: AUTO_FLAG_TYPES.has(acc.type),
  }))

  // GLBA: record that this user viewed the client's report PII. Never log the
  // raw HTML — only structural counts.
  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW_PII",
    entity: "Client",
    entityId: clientId,
    detail: { source: "CREDIT_REPAIR_CLOUD", via: "parse-crc", itemCount: items.length },
  })

  return NextResponse.json({ items, scores: parsed.scores })
}

async function parseCrcHtml(html: string) {
  // Dynamic import so Playwright is only loaded when this route is actually hit.
  const { chromium } = await import("playwright")
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    return await parseCreditRepairCloudReport(page)
  } finally {
    await browser.close()
  }
}
