import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { clockLabel } from "@/lib/fcra"
import { DISPUTE_STRATEGIES } from "@/lib/report-utils"

export default async function DisputesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  const disputes = await db.dispute.findMany({
    where: { clientId: id },
    include: {
      items: { select: { id: true, outcome: true, sentAt: true, dueAt: true } },
      letters: { select: { id: true, target: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <span className="text-ink font-medium">Disputes</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Dispute Rounds</h1>
        <Link
          href={`/clients/${id}/disputes/new`}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90"
        >
          + New Dispute
        </Link>
      </div>

      {disputes.length === 0 ? (
        <div className="border border-dashed border-secondary-soft rounded-lg p-12 text-center">
          <p className="text-muted text-sm">No disputes yet. Import a credit report and use the dispute wizard.</p>
          <Link
            href={`/clients/${id}/disputes/new`}
            className="mt-3 inline-block text-primary text-sm hover:underline"
          >
            Start first dispute →
          </Link>
        </div>
      ) : (
        <div className="border border-secondary-soft rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary-soft/30">
              <tr className="text-xs text-muted uppercase tracking-wide">
                <th className="py-3 px-4 text-left">Round</th>
                <th className="py-3 px-4 text-left">Strategy</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-center">Letters</th>
                <th className="py-3 px-4 text-left">FCRA Clock</th>
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {disputes.map(d => {
                const sent = d.items.find(it => it.sentAt)
                const firstDue = d.items.reduce<Date | null>((earliest, it) => {
                  if (!it.dueAt) return earliest
                  return !earliest || it.dueAt < earliest ? it.dueAt : earliest
                }, null)
                const strategyLabel = DISPUTE_STRATEGIES.find(s => s.value === d.strategy)?.label ?? d.strategy
                const pendingCount = d.items.filter(it => it.outcome === "PENDING").length
                const deletedCount = d.items.filter(it => it.outcome === "DELETED").length
                return (
                  <tr key={d.id} className="hover:bg-secondary-soft/10">
                    <td className="py-3 px-4">
                      <span className="font-bold text-ink">Round {d.round}</span>
                    </td>
                    <td className="py-3 px-4 text-muted max-w-48 truncate">{strategyLabel}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-ink">{d.items.length}</span>
                      {deletedCount > 0 && (
                        <span className="ml-1 text-xs text-success">({deletedCount} deleted)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-muted">{d.letters.length}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs ${!sent ? "text-muted" : firstDue && new Date() > firstDue ? "text-danger font-medium" : "text-success"}`}>
                        {clockLabel(sent?.sentAt ?? null, firstDue)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/clients/${id}/disputes/${d.id}`} className="text-primary text-sm hover:underline">
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
