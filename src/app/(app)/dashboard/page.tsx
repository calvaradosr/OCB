import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import Link from "next/link"

function KPI({ label, value, sub, accent, warn }: {
  label: string; value: string; sub?: string; accent?: string; warn?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accent ?? (warn ? "text-warning" : "text-ink")}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${warn ? "text-warning" : "text-muted"}`}>{sub}</p>}
    </div>
  )
}

function SubsystemCard({ href, title, description, stats }: {
  href: string; title: string; description: string; stats: { label: string; value: string }[]
}) {
  return (
    <Link href={href} className="block bg-white rounded-xl border border-secondary-soft p-5 hover:border-primary/40 hover:shadow-sm transition-all">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs text-muted mt-0.5 mb-4">{description}</p>
      <div className="flex gap-4">
        {stats.map(s => (
          <div key={s.label}>
            <p className="text-lg font-semibold text-ink">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </Link>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "AFFILIATE") redirect("/affiliate-portal")
  const { orgId } = session.user

  const canBilling = can(session.user.role, "billing:read")
  const canDisputes = can(session.user.role, "disputes:read")
  const canClients = can(session.user.role, "clients:read")
  const canLoans = can(session.user.role, "loans:read")
  const canTradelines = can(session.user.role, "tradelines:read")

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Client stats
  const [totalClients, activeClients, leadsThisMonth] = canClients
    ? await Promise.all([
        db.client.count({ where: { orgId } }),
        db.client.count({ where: { orgId, status: "ACTIVE" } }),
        db.client.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
      ])
    : [null, null, null]

  // Dispute stats
  const diScope = { dispute: { client: { orgId } } }
  const [openDisputes, deletedItems, totalResolvedItems, overdueDisputes, pendingLetters] = canDisputes
    ? await Promise.all([
        db.disputeItem.count({ where: { outcome: "PENDING", ...diScope } }),
        db.disputeItem.count({ where: { outcome: "DELETED", ...diScope } }),
        db.disputeItem.count({ where: { outcome: { not: "PENDING" }, ...diScope } }),
        db.disputeItem.count({ where: { outcome: "PENDING", dueAt: { lt: now }, ...diScope } }),
        db.letter.count({ where: { sentAt: null, client: { orgId } } }),
      ])
    : [null, null, null, null, null]

  const deletionRate = totalResolvedItems && totalResolvedItems > 0
    ? Math.round((deletedItems! / totalResolvedItems) * 100)
    : null

  // Billing stats
  const invoiceOrgScope = { client: { orgId } }
  const [collectedThisMonth, activeSubscriptions, failedInvoices] = canBilling
    ? await Promise.all([
        db.invoice.aggregate({
          _sum: { amountCents: true },
          where: { status: "PAID", createdAt: { gte: startOfMonth }, ...invoiceOrgScope },
        }).then(r => r._sum.amountCents ?? 0),
        db.subscription.count({ where: { status: { in: ["active", "trialing"] }, ...invoiceOrgScope } }),
        db.invoice.count({ where: { status: "FAILED", ...invoiceOrgScope } }),
      ])
    : [null, null, null]

  // Loan stats
  const [activeLoanFiles, fundedThisMonth] = canLoans
    ? await Promise.all([
        db.loanFile.count({ where: { orgId, status: { notIn: ["FUNDED", "DECLINED", "WITHDRAWN"] } } }),
        db.loanFile.count({ where: { orgId, status: "FUNDED", statusChangedAt: { gte: startOfMonth } } }),
      ])
    : [null, null]

  // Tradeline stats
  const [availableTradelines, activeOrders] = canTradelines
    ? await Promise.all([
        db.tradeline.count({ where: { orgId, active: true, availableAuSpots: { gt: 0 } } }),
        db.tradelineOrder.count({ where: { orgId, status: { in: ["INFO_SENT_TO_VENDOR", "POSTED"] } } }),
      ])
    : [null, null]

  // Today's tasks
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6)

  const todaysTasks = canDisputes
    ? await Promise.all([
        // Letters unsent
        db.letter.findMany({
          where: { sentAt: null, dispute: { client: { orgId } } },
          include: { dispute: { include: { client: { select: { firstName: true, lastName: true, id: true } } } } },
          take: 5,
          orderBy: { createdAt: "asc" },
        }),
        // FCRA clocks due this week
        db.disputeItem.findMany({
          where: { outcome: "PENDING", dueAt: { gte: now, lte: endOfWeek }, dispute: { client: { orgId } } },
          include: { dispute: { include: { client: { select: { firstName: true, lastName: true, id: true } } } } },
          take: 5,
          orderBy: { dueAt: "asc" },
        }),
      ])
    : [[], []]

  const [pendingLettersList, fcraThisWeek] = todaysTasks

  // Agent productivity
  const agentStats = canClients
    ? await db.user.findMany({
        where: { orgId, role: { in: ["AGENT", "MANAGER"] }, active: true },
        include: { clients: { select: { status: true }, where: { orgId, status: "ACTIVE" } } },
      })
    : []

  // Recent activity
  const recentActivity = await db.auditLog.findMany({
    where: {
      orgId,
      action: { in: ["CREATE", "UPDATE"] },
      entity: { in: ["Client", "DisputeItem", "Invoice", "LoanFile", "TradelineOrder"] },
    },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Top KPIs — always 4 columns */}
      <div className="grid grid-cols-4 gap-4">
        {canClients && (
          <KPI label="Active clients" value={String(activeClients ?? "—")} sub={`${leadsThisMonth ?? 0} new this month`} />
        )}
        {canDisputes && (
          <KPI label="Deletion rate" value={deletionRate != null ? `${deletionRate}%` : "—"} sub={`${deletedItems ?? 0} / ${totalResolvedItems ?? 0} resolved`} accent="text-success" />
        )}
        {canBilling && (
          <KPI label="Revenue this month" value={`$${(((collectedThisMonth as number) ?? 0) / 100).toLocaleString()}`} accent="text-success" sub={`${activeSubscriptions ?? 0} active subs`} />
        )}
        {canDisputes && (
          <KPI label="FCRA overdue" value={String(overdueDisputes ?? "—")} warn={!!overdueDisputes} sub={overdueDisputes ? "Needs action" : "All on track"} />
        )}
      </div>

      {/* Subsystem cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Modules</h2>
        <div className="grid grid-cols-3 gap-4">
          {canDisputes && (
            <SubsystemCard
              href="/disputes"
              title="Credit Repair"
              description="Blocks, letters &amp; FCRA tracking"
              stats={[
                { label: "open blocks", value: String(openDisputes ?? "—") },
                { label: "letters pending", value: String(pendingLetters ?? "—") },
                { label: "block rate", value: deletionRate != null ? `${deletionRate}%` : "—" },
              ]}
            />
          )}
          {canLoans && (
            <SubsystemCard
              href="/loans"
              title="Loan Processing"
              description="Pipeline management &amp; lender submissions"
              stats={[
                { label: "active files", value: String(activeLoanFiles ?? "—") },
                { label: "funded this month", value: String(fundedThisMonth ?? "—") },
              ]}
            />
          )}
          {canTradelines && (
            <SubsystemCard
              href="/tradelines"
              title="Tradelines"
              description="Inventory &amp; authorized user orders"
              stats={[
                { label: "available", value: String(availableTradelines ?? "—") },
                { label: "active orders", value: String(activeOrders ?? "—") },
              ]}
            />
          )}
        </div>
      </div>

      {/* Today's Tasks */}
      {canDisputes && (pendingLettersList.length > 0 || fcraThisWeek.length > 0) && (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-soft flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Today&apos;s Tasks</h2>
            <span className="text-xs text-muted">{pendingLettersList.length + fcraThisWeek.length} items</span>
          </div>
          <div className="divide-y divide-secondary-soft">
            {pendingLettersList.map(letter => (
              <div key={letter.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                  <span className="text-sm text-ink truncate">
                    Send letters — {letter.dispute?.client.firstName} {letter.dispute?.client.lastName}
                  </span>
                </div>
                <Link
                  href={letter.dispute ? `/clients/${letter.dispute.client.id}/disputes/${letter.dispute.id}` : "/letters"}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  View →
                </Link>
              </div>
            ))}
            {fcraThisWeek.map(item => {
              const dueDate = item.dueAt!
              const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              return (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${daysLeft <= 2 ? "bg-danger" : "bg-primary"}`} />
                    <span className="text-sm text-ink truncate">
                      FCRA response due — {item.dispute.client.firstName} {item.dispute.client.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${daysLeft <= 2 ? "text-danger" : "text-muted"}`}>
                      {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
                    </span>
                    <Link
                      href={`/clients/${item.dispute.client.id}/disputes/${item.dispute.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Agent load */}
        {canClients && agentStats.length > 0 && (
          <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
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
        <div className={`${canClients && agentStats.length > 0 ? "col-span-2" : "col-span-3"} bg-white rounded-xl border border-secondary-soft overflow-hidden`}>
          <div className="px-5 py-4 border-b border-secondary-soft">
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
                  <span className="text-xs text-muted">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { href: "/clients/new", label: "+ New client" },
          { href: "/loans/new", label: "+ New loan file" },
          { href: "/tradelines/new", label: "+ Add tradeline" },
          { href: "/automations/new", label: "+ New automation" },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl border border-secondary-soft p-4 text-sm text-muted hover:text-ink hover:border-primary/30 transition-colors text-center"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
