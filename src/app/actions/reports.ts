"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { AUTO_FLAG_TYPES } from "@/lib/report-utils"
import { verifyPostingForClient } from "@/app/actions/tradelines"
import { autoCreateLoanLead } from "@/app/actions/loans"
import { runAutomations } from "@/lib/automation"

export type ImportedItem = {
  creditorName: string
  accountNumberMasked: string
  type: string
  onExperian: boolean
  onEquifax: boolean
  onTransunion: boolean
  balance: string
  dateOpened: string
  flagged: boolean
}

export type ImportReportData = {
  source: "MANUAL_ENTRY" | "CSV_UPLOAD"
  scoreExperian: string
  scoreEquifax: string
  scoreTransunion: string
  items: ImportedItem[]
}

export async function importReport(
  clientId: string,
  data: ImportReportData
): Promise<{ reportId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }
  if (!can(session.user.role, "disputes:write")) return { error: "Forbidden" }

  if (!data.items.length) return { error: "Add at least one item before importing." }

  const toScore = (s: string) => {
    const n = parseInt(s, 10)
    return isNaN(n) ? null : n
  }

  const report = await db.creditReport.create({
    data: {
      clientId,
      source: data.source,
      scoreExperian: toScore(data.scoreExperian),
      scoreEquifax: toScore(data.scoreEquifax),
      scoreTransunion: toScore(data.scoreTransunion),
      items: {
        create: data.items.map(item => ({
          clientId,
          type: item.type as never,
          creditorName: item.creditorName.trim(),
          accountNumberMasked: item.accountNumberMasked.trim() || null,
          onExperian: item.onExperian,
          onEquifax: item.onEquifax,
          onTransunion: item.onTransunion,
          balance: item.balance ? parseFloat(item.balance) : null,
          dateOpened: item.dateOpened ? new Date(item.dateOpened) : null,
          flagged: item.flagged || AUTO_FLAG_TYPES.has(item.type),
        })),
      },
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "CreditReport",
    entityId: report.id,
    detail: { source: data.source, itemCount: data.items.length },
  })

  // Auto-check tradeline posting whenever a new report arrives (non-blocking)
  verifyPostingForClient(clientId, report.id).catch(() => {})
  // Credit-readiness bridge: auto-create a loan lead if scores just crossed the threshold
  autoCreateLoanLead(clientId, {
    experian: toScore(data.scoreExperian),
    equifax: toScore(data.scoreEquifax),
    transunion: toScore(data.scoreTransunion),
  }).catch(() => {})
  runAutomations({ trigger: "REPORT_IMPORTED", clientId, triggeredBy: report.id }).catch(() => {})

  return { reportId: report.id }
}

export async function toggleItemFlag(itemId: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  if (!can(session.user.role, "disputes:write")) throw new Error("Forbidden")

  const item = await db.reportItem.findUniqueOrThrow({ where: { id: itemId } })
  await db.reportItem.update({
    where: { id: itemId },
    data: { flagged: !item.flagged },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "ReportItem",
    entityId: itemId,
    detail: { flagged: !item.flagged },
  })
}
