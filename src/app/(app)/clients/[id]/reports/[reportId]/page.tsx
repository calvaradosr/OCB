import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ITEM_TYPE_LABELS, ITEM_TYPE_SEVERITY, type ItemTypeValue } from "@/lib/report-utils"
import { FlagToggle } from "./FlagToggle"

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

  const flaggedCount = report.items.filter(it => it.flagged).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
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
            Source: {report.source.replace(/_/g, " ")} ·{" "}
            {report.items.length} items · {flaggedCount > 0 && (
              <span className="text-danger font-medium">{flaggedCount} flagged</span>
            )}
          </p>
        </div>
        <Link
          href={`/clients/${id}/disputes/new`}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90"
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
            <div key={label} className="border border-secondary-soft rounded-lg p-4 text-center">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">{label}</p>
              {score ? (
                <>
                  <p className={`text-3xl font-bold ${
                    score >= 670 ? "text-success" : score >= 580 ? "text-warning" : "text-danger"
                  }`}>{score}</p>
                  <p className="text-xs text-muted mt-1">
                    {score >= 740 ? "Excellent" : score >= 670 ? "Good" : score >= 580 ? "Fair" : "Poor"}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-muted">—</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3-bureau grid */}
      <div className="border border-secondary-soft rounded-lg overflow-hidden">
        <div className="bg-secondary-soft/30 px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Tradeline / Item Grid</h2>
          <span className="text-xs text-muted">{report.items.length} items · click 🚩 to toggle flag</span>
        </div>
        {report.items.length === 0 ? (
          <p className="text-sm text-muted p-6 text-center">No items in this report.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-secondary-soft">
                <tr className="text-xs text-muted uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">Creditor</th>
                  <th className="py-3 px-4 text-left">Type</th>
                  <th className="py-3 px-4 text-center">EXP</th>
                  <th className="py-3 px-4 text-center">EQ</th>
                  <th className="py-3 px-4 text-center">TU</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-left">Opened</th>
                  <th className="py-3 px-4 text-center">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-soft">
                {report.items.map(item => {
                  const severity = ITEM_TYPE_SEVERITY[item.type as ItemTypeValue] ?? "info"
                  return (
                    <tr
                      key={item.id}
                      className={
                        item.flagged
                          ? "bg-danger/5"
                          : severity === "warning"
                          ? "bg-warning/5"
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
                            <span className="text-success font-bold text-base">✓</span>
                          ) : (
                            <span className="text-muted text-base">—</span>
                          )}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right text-ink">
                        {item.balance != null ? `$${Number(item.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-muted">
                        {item.dateOpened ? item.dateOpened.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
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
