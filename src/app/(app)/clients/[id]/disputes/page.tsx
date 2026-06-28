import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { clockLabel, isOverdue } from "@/lib/fcra"
import { DISPUTE_STRATEGIES } from "@/lib/report-utils"

const OUTCOME_COLORS: Record<string, string> = {
  PENDING: "bg-warning/20",
  DELETED: "bg-success/20",
  REPAIRED: "bg-primary/20",
  VERIFIED: "bg-danger/20",
  NO_RESPONSE: "bg-muted/20",
}

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
      items: { select: { id: true, outcome: true, sentAt: true, dueAt: true, bureau: true } },
      letters: { select: { id: true, target: true, bureau: true } },
    },
    orderBy: { round: "desc" },
  })

  const now = new Date()

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <span className="text-ink font-medium">Blocks</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Blocking Rounds</h1>
          <p className="text-sm text-muted mt-0.5">
            {disputes.length} round{disputes.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link
          href={`/clients/${id}/disputes/new`}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          + New Round
        </Link>
      </div>

      {disputes.length === 0 ? (
        <div className="bg-white border border-dashed border-secondary-soft rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary-soft flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="font-semibold text-ink mb-1">No blocking rounds yet</p>
          <p className="text-sm text-muted mb-4">Import a credit report, flag items, then start a blocking round.</p>
          <Link
            href={`/clients/${id}/disputes/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Start first block →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(d => {
            const sentAt = d.items.find(it => it.sentAt)?.sentAt ?? null
            const dueAt = d.items.reduce<Date | null>((earliest, it) => {
              if (!it.dueAt) return earliest
              return !earliest || it.dueAt < earliest ? it.dueAt : earliest
            }, null)

            const isSent = !!sentAt
            const overdue = dueAt && isOverdue(dueAt, now)

            const counts = {
              total: d.items.length,
              deleted: d.items.filter(i => i.outcome === "DELETED").length,
              repaired: d.items.filter(i => i.outcome === "REPAIRED").length,
              verified: d.items.filter(i => i.outcome === "VERIFIED").length,
              pending: d.items.filter(i => i.outcome === "PENDING").length,
              noResponse: d.items.filter(i => i.outcome === "NO_RESPONSE").length,
            }

            const bureaus = [...new Set(d.items.map(i => i.bureau))]

            const strategyLabel = DISPUTE_STRATEGIES.find(s => s.value === d.strategy)?.label ?? d.strategy

            // Stage
            const stage = !isSent ? "draft" : counts.pending > 0 ? "active" : "complete"
            const stageBg = stage === "draft" ? "bg-secondary-soft text-muted" : stage === "active" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"
            const stageLabel = stage === "draft" ? "Draft" : stage === "active" ? "Awaiting Response" : "Complete"

            return (
              <div
                key={d.id}
                className={`bg-white rounded-xl border transition-all ${overdue ? "border-danger/40" : "border-secondary-soft"}`}
              >
                <div className="p-5">
                  {/* Round header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{d.round}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-ink">Round {d.round}</h3>
                        <p className="text-xs text-muted">{strategyLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stageBg}`}>
                        {stageLabel}
                      </span>
                      {isSent && dueAt && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${overdue ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                          {clockLabel(sentAt, dueAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-ink">{counts.total}</p>
                      <p className="text-xs text-muted">Items</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${counts.deleted > 0 ? "text-success" : "text-muted"}`}>{counts.deleted}</p>
                      <p className="text-xs text-muted">Blocked</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-muted">{counts.pending}</p>
                      <p className="text-xs text-muted">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-ink">{d.letters.length}</p>
                      <p className="text-xs text-muted">Letters</p>
                    </div>
                  </div>

                  {/* Outcome bar */}
                  {counts.total > 0 && (
                    <div className="flex rounded-full overflow-hidden h-2 mb-4 bg-secondary-soft">
                      {counts.deleted > 0 && (
                        <div className="bg-success" style={{ width: `${(counts.deleted / counts.total) * 100}%` }} />
                      )}
                      {counts.repaired > 0 && (
                        <div className="bg-primary" style={{ width: `${(counts.repaired / counts.total) * 100}%` }} />
                      )}
                      {counts.verified > 0 && (
                        <div className="bg-danger" style={{ width: `${(counts.verified / counts.total) * 100}%` }} />
                      )}
                      {counts.noResponse > 0 && (
                        <div className="bg-muted" style={{ width: `${(counts.noResponse / counts.total) * 100}%` }} />
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>{d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      {bureaus.length > 0 && (
                        <span>
                          {bureaus.map(b => b.charAt(0) + b.slice(1).toLowerCase()).join(" · ")}
                        </span>
                      )}
                      {isSent && sentAt && (
                        <span>Sent {sentAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      )}
                    </div>
                    <Link
                      href={`/clients/${id}/disputes/${d.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary hover:text-white transition-colors"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>

                {/* Overdue banner */}
                {overdue && (
                  <div className="border-t border-danger/20 bg-danger/5 px-5 py-2.5 rounded-b-xl">
                    <p className="text-xs text-danger font-medium">
                      FCRA 30-day clock expired — follow up with bureaus immediately
                    </p>
                  </div>
                )}

                {/* Draft banner */}
                {!isSent && d.letters.length > 0 && (
                  <div className="border-t border-secondary-soft bg-secondary-soft/30 px-5 py-2.5 rounded-b-xl flex items-center justify-between">
                    <p className="text-xs text-muted">
                      {d.letters.length} letter{d.letters.length !== 1 ? "s" : ""} ready — print, mail, then mark as sent
                    </p>
                    <Link href={`/clients/${id}/disputes/${d.id}`} className="text-xs text-primary hover:underline">
                      Mark as Sent →
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
