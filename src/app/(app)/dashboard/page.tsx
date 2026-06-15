import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import Link from "next/link"

function kpi(label: string, value: string, sub?: string, color?: string) {
  return { label, value, sub, color }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  // Affiliate role goes to their own portal
  if (session.user.role === "AFFILIATE") redirect("/affiliate-portal")

  const canBilling = can(session.user.role, "billing:read")
  const canDisputes = can(session.user.role, "disputes:read")
  const canClients = can(session.user.role, "clients:read")

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // ── Client stats ─────────────────────────────────────────────────────────────
  const [totalClients, activeClients, leadsThisMonth] = canClients
    ? await Promise.all([
        db.client.count(),
        db.client.count({ where: { status: "ACTIVE" } }),
        db.client.count({ where: { createdAt: { gte: startOfMonth } } }),
      ])
    : [null, null, null]

  // ── Dispute stats ─────────────────────────────────────────────────────────────
  const [totalItems, deletedItems, openDisputes] = canDisputes
    ? await Promise.all([
        db.disputeItem.count({ where: { outcome: { not: "PENDING" } } }),
        db.disputeItem.count({ where: { outcome: "DELETED" } }),
        db.dispute.count({ where: { outcome: "PENDING" } }),
      ])
    : [null, null, null]

  const deletionRate = totalItems && totalItems > 0
    ? Math.round((deletedItems! / totalItems) * 100)
    : null

  // ── Revenue stats ─────────────────────────────────────────────────────────────
  const [collectedThisMonth, overdueCount, mrrCents] = canBilling
    ? await Promise.all([
        db.invoice.aggregate({
          _sum: { amountCents: true },
          where: { status: "PAID", updatedAt: { gte: startOfMonth } },
        }).then(r => r._sum.amountCents ?? 0),
        db.invoice.count({ where: { status: "OVERDUE" } }),
        db.subscription.aggregate({
          _sum: { amountCents: true },
          where: { status: { in: ["ACTIVE", "TRIALING"] } },
        }).then(r => r._sum.amountCents ?? 0).catch(() => 0),
      ])
    : [null, null, null]

  // ── Agent productivity ────────────────────────────────────────────────────────
  const agentStats = canClients
    ? await db.user.findMany({
        where: { role: { in: ["AGENT", "MANAGER"] }, active: true },
        include: {
          clients: {
            select: { status: true },
            where: { status: "ACTIVE" },
          },
        },
      })
    : []

  // ── Overdues FCRA ─────────────────────────────────────────────────────────────
  const overdueDisputes = canDisputes
    ? await db.dispute.count({
        where: {
          outcome: "PENDING",
          dueAt: { lt: now },
        },
      })
    : null

  // ── Recent activity ───────────────────────────────────────────────────────────
  const recentActivity = await db.auditLog.findMany({
    where: { action: { in: ["CREATE", "UPDATE"] }, entity: { in: ["Client", "DisputeItem", "Invoice", "LoanFile", "TradelineOrder"] } },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-muted mt-1">{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {canClients && (
          <>
            <KPICard label="Active clients" value={String(activeClients ?? "—")} sub={`${leadsThisMonth ?? 0} new this month`} />
            <KPICard label="Total clients" value={String(totalClients ?? "—")} />
          </>
        )}
        {canDisputes && (
          <>
            <KPICard label="Deletion rate" value={deletionRate != null ? `${deletionRate}%` : "—"} sub={`${deletedItems ?? 0} / ${totalItems ?? 0} items`} color="text-success" />
            <KPICard label="Open disputes" value={String(openDisputes ?? "—")} sub={overdueDisputes ? `${overdueDisputes} overdue` : undefined} warningIf={!!overdueDisputes} />
          </>
        )}
        {canBilling && (
          <>
            <KPICard label="Collected this month" value={`$${((collectedThisMonth as number) / 100).toLocaleString()}`} color="text-success" />
            <KPICard label="MRR" value={`$${((mrrCents as number) / 100).toLocaleString()}`} />
            <KPICard label="Overdue invoices" value={String(overdueCount ?? "—")} warningIf={!!overdueCount} />
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Agent productivity */}
        {canClients && agentStats.length > 0 && (
          <div className="col-span-1 bg-white rounded-xl border border-secondary-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-secondary-soft">
              <h2 className="text-sm font-semibold text-ink">Agent load</h2>
            </div>
            <div className="divide-y divide-secondary-soft">
              {agentStats.map(a => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm text-ink">{a.name}</span>
                  <span className="text-xs font-semibold text-muted">{a.clients.length} active</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="col-span-2 bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-soft flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent activity</h2>
          </div>
          {recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted text-center">No activity yet.</p>
          ) : (
            <div className="divide-y divide-secondary-soft">
              {recentActivity.map(log => (
                <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-ink">{log.action} {log.entity}</span>
                    {log.actor && <span className="text-xs text-muted ml-2">by {log.actor.name}</span>}
                  </div>
                  <span className="text-xs text-muted">{new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { href: "/clients/new", label: "+ New client" },
          { href: "/loans/new", label: "+ New loan" },
          { href: "/tradelines/new", label: "+ Add tradeline" },
          { href: "/automations/new", label: "+ New automation" },
        ].map(({ href, label }) => (
          <Link key={href} href={href} className="bg-white rounded-xl border border-secondary-soft p-4 text-sm text-muted hover:text-ink hover:border-primary/30 transition-colors text-center">
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function KPICard({
  label,
  value,
  sub,
  color,
  warningIf,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  warningIf?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color ?? (warningIf ? "text-warning" : "text-ink")}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${warningIf ? "text-warning" : "text-muted"}`}>{sub}</p>}
    </div>
  )
}
