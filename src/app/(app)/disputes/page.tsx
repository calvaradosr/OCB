import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { clockLabel, isOverdue } from "@/lib/fcra"
import { DISPUTE_STRATEGIES } from "@/lib/report-utils"

export default async function DisputesDashboard() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const disputes = await db.dispute.findMany({
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      items: { select: { id: true, outcome: true, sentAt: true, dueAt: true } },
      letters: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const now = new Date()
  const overdueCount = disputes.filter(d => {
    const due = d.items.reduce<Date | null>((earliest, it) => {
      if (!it.dueAt) return earliest
      return !earliest || it.dueAt < earliest ? it.dueAt : earliest
    }, null)
    return due && isOverdue(due, now)
  }).length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">All Disputes</h1>
        {overdueCount > 0 && (
          <span className="px-3 py-1 bg-danger/10 text-danger text-sm font-medium rounded-full">
            {overdueCount} overdue
          </span>
        )}
      </div>

      {disputes.length === 0 ? (
        <div className="border border-dashed border-secondary-soft rounded-lg p-12 text-center">
          <p className="text-muted text-sm">No disputes yet. Open a client profile to start the dispute wizard.</p>
        </div>
      ) : (
        <div className="border border-secondary-soft rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
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
                const firstDue = d.items.reduce<Date | null>((earliest, it) => {
                  if (!it.dueAt) return earliest
                  return !earliest || it.dueAt < earliest ? it.dueAt : earliest
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
                      <Link
                        href={`/clients/${d.client.id}/disputes/${d.id}`}
                        className="text-primary text-sm hover:underline"
                      >
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
