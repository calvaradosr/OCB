import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { clockLabel, isOverdue } from "@/lib/fcra"
import { DISPUTE_STRATEGIES } from "@/lib/report-utils"

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accent ?? "text-ink"}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function DisputesDashboard() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [disputes, totalItems, deletedItems, pendingLetters, roundsThisMonth] = await Promise.all([
    db.dispute.findMany({
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { id: true, outcome: true, sentAt: true, dueAt: true } },
        letters: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.disputeItem.count({ where: { outcome: { not: "PENDING" } } }),
    db.disputeItem.count({ where: { outcome: "DELETED" } }),
    db.letter.count({ where: { sentAt: null } }),
    db.dispute.count({ where: { createdAt: { gte: startOfMonth } } }),
  ])

  const openDisputes = disputes.filter(d => d.items.some(i => i.outcome === "PENDING")).length
  const overdueCount = disputes.filter(d => {
    const firstDue = d.items.reduce<Date | null>((e, it) => {
      if (!it.dueAt) return e
      return !e || it.dueAt < e ? it.dueAt : e
    }, null)
    return firstDue && isOverdue(firstDue, now)
  }).length

  const deletionRate = totalItems > 0 ? Math.round((deletedItems / totalItems) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Disputes</h1>
          <p className="text-sm text-muted mt-1">Dispute pipeline &amp; FCRA tracking</p>
        </div>
        {overdueCount > 0 && (
          <span className="px-3 py-1 bg-danger/10 text-danger text-sm font-medium rounded-full">
            {overdueCount} FCRA overdue
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Open disputes" value={String(openDisputes)} sub={`${roundsThisMonth} rounds this month`} />
        <Stat label="Deletion rate" value={`${deletionRate}%`} sub={`${deletedItems} / ${totalItems} items`} accent="text-success" />
        <Stat label="Letters pending" value={String(pendingLetters)} sub="Awaiting delivery" accent={pendingLetters > 0 ? "text-warning" : undefined} />
        <Stat label="FCRA overdue" value={String(overdueCount)} accent={overdueCount > 0 ? "text-danger" : "text-ink"} />
      </div>

      {/* Dispute table */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">All Disputes</h2>
        <Link href="/letters" className="text-xs text-primary hover:underline">Print queue →</Link>
      </div>

      {disputes.length === 0 ? (
        <div className="bg-white border border-dashed border-secondary-soft rounded-xl p-12 text-center">
          <p className="text-muted">No disputes yet.</p>
          <p className="text-xs text-muted mt-1">Open a client profile to start the dispute wizard.</p>
        </div>
      ) : (
        <div className="bg-white border border-secondary-soft rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/30">
              <tr className="text-xs text-muted uppercase tracking-wide">
                <th className="py-3 px-4 text-left">Client</th>
                <th className="py-3 px-4 text-left">Round</th>
                <th className="py-3 px-4 text-left">Strategy</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-left">FCRA Clock</th>
                <th className="py-3 px-4 text-left">Created</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {disputes.map(d => {
                const sentItem = d.items.find(it => it.sentAt)
                const firstDue = d.items.reduce<Date | null>((e, it) => {
                  if (!it.dueAt) return e
                  return !e || it.dueAt < e ? it.dueAt : e
                }, null)
                const overdue = firstDue && isOverdue(firstDue, now)
                const strategyLabel = DISPUTE_STRATEGIES.find(s => s.value === d.strategy)?.label ?? d.strategy
                return (
                  <tr key={d.id} className={`hover:bg-secondary-soft/10 ${overdue ? "bg-danger/5" : ""}`}>
                    <td className="py-3 px-4 font-medium text-ink">
                      <Link href={`/clients/${d.client.id}`} className="hover:text-primary">
                        {d.client.firstName} {d.client.lastName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-muted">Round {d.round}</td>
                    <td className="py-3 px-4 text-muted truncate max-w-40">{strategyLabel}</td>
                    <td className="py-3 px-4 text-center text-muted">{d.items.length}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${overdue ? "text-danger" : !sentItem ? "text-muted" : "text-success"}`}>
                        {clockLabel(sentItem?.sentAt ?? null, firstDue)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted text-xs">
                      {d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/clients/${d.client.id}/disputes/${d.id}`} className="text-primary text-sm hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
