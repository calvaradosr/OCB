import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ITEM_TYPE_LABELS, ITEM_TYPE_SEVERITY, type ItemTypeValue } from "@/lib/report-utils"
import { FlagToggle } from "./FlagToggle"

const OUTCOME_PILL: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  DELETED: "bg-success/10 text-success",
  REPAIRED: "bg-primary/10 text-primary",
  VERIFIED: "bg-danger/10 text-danger",
  NO_RESPONSE: "bg-muted/10 text-muted",
}
const OUTCOME_LABEL: Record<string, string> = {
  PENDING: "In Dispute",
  DELETED: "Deleted",
  REPAIRED: "Repaired",
  VERIFIED: "Verified",
  NO_RESPONSE: "No Response",
}

export default async function ReportViewPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id, reportId } = await params

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  const report = await db.creditReport.findUnique({
    where: { id: reportId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!report || report.clientId !== id) notFound()

  // Get the latest dispute status for each report item
  const disputeItems = await db.disputeItem.findMany({
    where: { item: { reportId } },
    include: { dispute: { select: { round: true } } },
    orderBy: { dispute: { createdAt: "desc" } },
  })

  // Map itemId -> best outcome (prefer non-pending)
  const itemDisputeMap = new Map<string, { outcome: string; round: number }>()
  for (const di of disputeItems) {
    const existing = itemDisputeMap.get(di.itemId)
    if (!existing || di.outcome !== "PENDING") {
      itemDisputeMap.set(di.itemId, { outcome: di.outcome, round: di.dispute.round })
    }
  }

  const flaggedCount = report.items.filter(it => it.flagged).length
  const inDisputeCount = report.items.filter(it => itemDisputeMap.has(it.id) && itemDisputeMap.get(it.id)!.outcome === "PENDING").length
  const deletedCount = report.items.filter(it => itemDisputeMap.get(it.id)?.outcome === "DELETED").length

  return (
    <div className="max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <Link href={`/clients/${id}/reports`} className="hover:text-ink">Reports</Link>
        <span>›</span>
        <span className="text-ink font-medium">
          {report.pulledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Credit Report</h1>
          <p className="text-sm text-muted mt-0.5">
            {report.source.replace(/_/g, " ")} · {report.items.length} items
          </p>
        </div>
        <Link
          href={`/clients/${id}/disputes/new`}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Start Dispute Wizard →
        </Link>
      </div>

      {/* Score cards */}
      {(report.scoreExperian || report.scoreEquifax || report.scoreTransunion) && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Experian", score: report.scoreExperian },
            { label: "Equifax", score: report.scoreEquifax },
            { label: "TransUnion", score: report.scoreTransunion },
          ].map(({ label, score }) => (
            <div key={label} className="bg-white border border-secondary-soft rounded-xl p-4 text-center">
              <p className="text-xs text-muted uppercase tracking-widest mb-2">{label}</p>
              {score ? (
                <>
                  <p className={`text-4xl font-bold ${
                    score >= 740 ? "text-success" : score >= 670 ? "text-primary" : score >= 580 ? "text-warning" : "text-danger"
                  }`}>{score}</p>
                  <p className="text-xs text-muted mt-1">
                    {score >= 740 ? "Excellent" : score >= 670 ? "Good" : score >= 580 ? "Fair" : "Poor"}
                  </p>
                </>
              ) : (
                <p className="text-3xl font-bold text-muted">—</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Item summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted">{report.items.length} total items</span>
        {flaggedCount > 0 && (
          <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">{flaggedCount} flagged</span>
        )}
        {inDisputeCount > 0 && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{inDisputeCount} in dispute</span>
        )}
        {deletedCount > 0 && (
          <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">{deletedCount} deleted</span>
        )}
      </div>

      {/* 3-bureau item grid */}
      <div className="bg-white border border-secondary-soft rounded-xl overflow-hidden">
        <div className="bg-secondary-soft/30 px-5 py-3 flex items-center justify-between border-b border-secondary-soft">
          <h2 className="font-semibold text-ink">Account Grid</h2>
          <span className="text-xs text-muted">Click 🚩 to flag an item for dispute</span>
        </div>
        {report.items.length === 0 ? (
          <p className="text-sm text-muted p-8 text-center">No items in this report.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-secondary-soft bg-secondary-soft/10">
                <tr className="text-xs text-muted uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">Creditor / Account</th>
                  <th className="py-3 px-4 text-left">Type</th>
                  <th className="py-3 px-4 text-center w-12">EXP</th>
                  <th className="py-3 px-4 text-center w-12">EQF</th>
                  <th className="py-3 px-4 text-center w-12">TU</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-left">Opened</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center w-10">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-soft">
                {report.items.map(item => {
                  const severity = ITEM_TYPE_SEVERITY[item.type as ItemTypeValue] ?? "info"
                  const disputeStatus = itemDisputeMap.get(item.id)
                  return (
                    <tr
                      key={item.id}
                      className={
                        item.flagged
                          ? "bg-danger/5"
                          : severity === "warning"
                          ? "bg-warning/[0.03]"
                          : ""
                      }
                    >
                      <td className="py-3 px-4">
                        <p className="font-medium text-ink">{item.creditorName}</p>
                        {item.accountNumberMasked && (
                          <p className="text-xs text-muted">{item.accountNumberMasked}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium
                          ${severity === "danger" ? "bg-danger/10 text-danger" :
                            severity === "warning" ? "bg-warning/10 text-warning" :
                            "bg-secondary-soft text-muted"}`}>
                          {ITEM_TYPE_LABELS[item.type as ItemTypeValue] ?? item.type}
                        </span>
                      </td>
                      {[item.onExperian, item.onEquifax, item.onTransunion].map((present, i) => (
                        <td key={i} className="py-3 px-4 text-center">
                          {present ? (
                            <span className="text-danger font-bold">✕</span>
                          ) : (
                            <span className="text-success font-bold">✓</span>
                          )}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right text-ink">
                        {item.balance != null ? `$${Number(item.balance).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-muted text-xs">
                        {item.dateOpened ? item.dateOpened.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {disputeStatus ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OUTCOME_PILL[disputeStatus.outcome] ?? ""}`}>
                            {OUTCOME_LABEL[disputeStatus.outcome] ?? disputeStatus.outcome}
                          </span>
                        ) : item.flagged ? (
                          <span className="text-xs text-warning font-medium">Flagged</span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <FlagToggle itemId={item.id} flagged={item.flagged} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
