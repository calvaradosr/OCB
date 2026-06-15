import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { runAutomations } from "@/lib/automation"

// Called daily by a cron service (GitHub Actions, Vercel Cron, or ECS scheduled task).
// Fires FCRA_CLOCK_30_DAYS and FCRA_CLOCK_45_DAYS automations for overdue dispute items.
// Secured by CRON_SECRET header.
export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret")
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Items past their 30-day due date that haven't been resolved or already triggered
  const overdueItems = await db.disputeItem.findMany({
    where: {
      outcome: "PENDING",
      dueAt: { lt: now },
      sentAt: { not: null },
    },
    include: {
      dispute: { select: { clientId: true } },
    },
    take: 200,
  })

  let fired30 = 0
  let fired45 = 0

  for (const item of overdueItems) {
    const clientId = item.dispute.clientId
    const daysPast = item.dueAt
      ? Math.floor((now.getTime() - item.dueAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // 45-day items (foreign creditors — dueAt was set to sentAt + 45 days)
    // We approximate: if the gap from sentAt to dueAt was 45 days
    const isForty5 = item.sentAt && item.dueAt
      ? Math.round((item.dueAt.getTime() - item.sentAt.getTime()) / (1000 * 60 * 60 * 24)) >= 44
      : false

    if (isForty5) {
      await runAutomations({
        trigger: "FCRA_CLOCK_45_DAYS",
        clientId,
        triggeredBy: item.id,
      }).catch(() => {})
      fired45++
    } else {
      await runAutomations({
        trigger: "FCRA_CLOCK_30_DAYS",
        clientId,
        triggeredBy: item.id,
      }).catch(() => {})
      fired30++
    }
  }

  return NextResponse.json({ fired30, fired45, total: overdueItems.length })
}
