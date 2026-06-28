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

export default async function DisputesDashboard({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { orgId } = session.user

  const { filter = "open" } = await searchParams

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const clientScope = { client: { orgId } }

  const [allDisputes, totalItems, deletedItems, pendingLetters, roundsThisMonth] = await Promise.all([
    db.dispute.findMany({
      where: clientScope,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { id: true, outcome: true, sentAt: true, dueAt: true } },
        letters: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.disputeItem.count({ where: { outcome: { not: "PENDING" }, dispute: clientScope } }),
    db.disputeItem.count({ where: { outcome: "DELETED", dispute: clientScope } }),
    db.letter.count({ where: { sentAt: null, dispute: clientScope } }),
    db.dispute.count({ where: { ...clientScope, createdAt: { gte: startOfMonth } } }),
  ])

  const isOpen = (d: typeof allDisputes[0]) => d.items.some(i => i.outcome === "PENDING")
  const getFirstDue = (d: typeof allDisputes[0]) =>
    d.items.reduce<Date | null>((e, it) => {
      if (!it.dueAt) return e
      return !e || it.dueAt < e ? it.dueAt : e
    }, null)
  const isDisputeOverdue = (d: typeof allDisputes[0]) => {
    const fd = getFirstDue(d)
    return fd && isOverdue(fd, now)
  }

  const openDisputes = allDisputes.filter(isOpen).length
  const overdueCount = allDisputes.filter(isDisputeOverdue).length
  const deletionRate = totalItems > 0 ? Math.round((deletedItems / totalItems) * 100) : 0

  const disputes = filter === "overdue"
    ? allDisputes.filter(isDisputeOverdue)
    : filter === "open"
    ? allDisputes.filter(isOpen)
    : allDisputes

  const TABS = [
    { value: "open", label: `Open (${openDisputes})` },
    { value: "overdue", label: `FCRA Overdue (${overdueCount})`, danger: true },
    { value: "all", label: `All (${allDisputes.length})` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Blocks</h1>
          <p className="text-sm text-muted mt-1">Blocking pipeline &amp; FCRA tracking</p>
        </div>
        <Link href="/letters" className="text-xs text-primary hover:underline px-3 py-1.5 border border-secondary-soft rounded-lg">
          Print queue →
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Open blocks" value={String(openDisputes)} sub={`${roundsThisMonth} rounds this month`} />
        <Stat label="Block rate" value={`${deletionRate}%`} sub={`${deletedItems} / ${totalItems} items`} accent="text-success" />
        <Stat label="Letters pending" value={String(pendingLetters)} sub="Awaiting delivery" accent={pendingLetters > 0 ? "text-warning" : undefined} />
        <Stat label="FCRA overdue" value={String(overdueCount)} accent={overdueCount > 0 ? "text-danger" : "text-ink"} />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-secondary-soft">
        {TABS.map(tab => (
          <Link
            key={tab.value}
            href={`/disputes?filter=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === tab.value
                ? tab.danger ? "border-danger text-danger" : "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {disputes.length === 0 ? (
        <div className="bg-white border border-dashed border-secondary-soft rounded-xl p-12 text-center">
          <p className="text-muted">{filter === "overdue" ? "No overdue blocks." : filter === "open" ? "No open blocks." : "No blocks yet."}</p>
          <p className="text-xs text-muted mt-1">Open a client profile to start the blocking wizard.</p>
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
                <th className="py-3 px-4 text-center">Blocked</th>
                <th className="py-3 px-4 text-left">FCRA Clock</th>
                <th className="py-3 px-4 text-left">Created</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {disputes.map(d => {
                const sentItem = d.items.find(it => it.sentAt)
                const firstDue = getFirstDue(d)
                const overdue = isDisputeOverdue(d)
                const deletedInRound = d.items.filter(it => it.outcome === "DELETED").length
                const strategyLabel = DISPUTE_STRATEGIES.find(s => s.value === d.strategy)?.label ?? d.strategy
                return (
                  <tr key={d.id} className={`hover:bg-secondary-soft/10 ${overdue ? "bg-danger/5" : ""}`}>
                    <td className="py-3 px-4 font-medium text-ink">
                      <Link href={`/clients/${d.client.id}`} className="hover:text-primary">
                        {d.client.firstName} {d.client.lastName}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">
                        {d.round}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted truncate max-w-40">{strategyLabel}</td>
                    <td className="py-3 px-4 text-center text-muted">{d.items.length}</td>
                    <td className="py-3 px-4 text-center">
                      {deletedInRound > 0
                        ? <span className="text-success font-semibold">{deletedInRound}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                          OVERDUE
                        </span>
                      ) : (
                        <span className={`text-xs font-medium ${!sentItem ? "text-muted" : "text-success"}`}>
                          {clockLabel(sentItem?.sentAt ?? null, firstDue)}
                        </span>
                      )}
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
