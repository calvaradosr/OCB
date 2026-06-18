import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import Link from "next/link"

function KPI({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-5">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ?? "text-ink"}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-secondary-soft rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

export default async function ReportsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "disputes:read")) redirect("/dashboard")
  const { orgId } = session.user

  const now = new Date()
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLast3M = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const startOfYear   = new Date(now.getFullYear(), 0, 1)

  const diScope = { dispute: { client: { orgId } } }
  const letterScope = { client: { orgId } }

  // ── Clients ────────────────────────────────────────────────────────────────
  const [
    totalClients, activeClients, newThisMonth, newLast3M,
    statusCounts,
  ] = await Promise.all([
    db.client.count({ where: { orgId } }),
    db.client.count({ where: { orgId, status: "ACTIVE" } }),
    db.client.count({ where: { orgId, createdAt: { gte: startOfMonth } } }),
    db.client.count({ where: { orgId, createdAt: { gte: startOfLast3M } } }),
    db.client.groupBy({ by: ["status"], where: { orgId }, _count: { _all: true } }),
  ])

  // ── Disputes ───────────────────────────────────────────────────────────────
  const [
    totalDisputeItems, deletedItems, repairedItems, verifiedItems, noResponseItems,
    openItems, overdueItems,
    totalRounds, roundsThisMonth,
  ] = await Promise.all([
    db.disputeItem.count({ where: { ...diScope } }),
    db.disputeItem.count({ where: { outcome: "DELETED",     ...diScope } }),
    db.disputeItem.count({ where: { outcome: "REPAIRED",    ...diScope } }),
    db.disputeItem.count({ where: { outcome: "VERIFIED",    ...diScope } }),
    db.disputeItem.count({ where: { outcome: "NO_RESPONSE", ...diScope } }),
    db.disputeItem.count({ where: { outcome: "PENDING",     ...diScope } }),
    db.disputeItem.count({ where: { outcome: "PENDING", dueAt: { lt: now }, ...diScope } }),
    db.dispute.count({ where: { client: { orgId } } }),
    db.dispute.count({ where: { client: { orgId }, createdAt: { gte: startOfMonth } } }),
  ])

  const totalResolved = deletedItems + repairedItems + verifiedItems + noResponseItems
  const deletionRate = totalResolved > 0 ? Math.round((deletedItems / totalResolved) * 100) : 0
  const removalRate  = totalResolved > 0 ? Math.round(((deletedItems + repairedItems) / totalResolved) * 100) : 0

  // Bureau breakdown
  const bureauStats = await db.disputeItem.groupBy({
    by: ["bureau"],
    where: diScope,
    _count: { _all: true },
  })
  const bureauDeleted = await db.disputeItem.groupBy({
    by: ["bureau"],
    where: { outcome: "DELETED", ...diScope },
    _count: { _all: true },
  })
  const bureauDeletedMap = Object.fromEntries(bureauDeleted.map(b => [b.bureau, b._count._all]))

  // ── Letters ─────────────────────────────────────────────────────────────────
  const [totalLetters, sentLetters, unsentLetters] = await Promise.all([
    db.letter.count({ where: letterScope }),
    db.letter.count({ where: { sentAt: { not: null }, ...letterScope } }),
    db.letter.count({ where: { sentAt: null, ...letterScope } }),
  ])

  // ── Billing ─────────────────────────────────────────────────────────────────
  const canBilling = can(session.user.role, "billing:read")
  const [revenueYTD, revenueThisMonth, activeSubscriptions, openInvoices] = canBilling
    ? await Promise.all([
        db.invoice.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", createdAt: { gte: startOfYear  }, client: { orgId } } }).then(r => r._sum.amountCents ?? 0),
        db.invoice.aggregate({ _sum: { amountCents: true }, where: { status: "PAID", createdAt: { gte: startOfMonth }, client: { orgId } } }).then(r => r._sum.amountCents ?? 0),
        db.subscription.count({ where: { status: { in: ["active", "trialing"] }, client: { orgId } } }),
        db.invoice.count({ where: { status: "OPEN", client: { orgId } } }),
      ])
    : [null, null, null, null]

  // ── Monthly new clients (last 6 months for trend) ──────────────────────────
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const monthlyClients = await db.client.groupBy({
    by: ["createdAt"],
    where: { orgId, createdAt: { gte: sixMonthsAgo } },
    _count: { _all: true },
  })

  // Build month buckets
  const months: { label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    const count = monthlyClients.filter(r => {
      const rd = new Date(r.createdAt)
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
    }).reduce((s, r) => s + r._count._all, 0)
    months.push({ label, count })
  }
  const maxMonthCount = Math.max(1, ...months.map(m => m.count))

  const BUREAU_LABEL: Record<string, string> = {
    EXPERIAN: "Experian", EQUIFAX: "Equifax", TRANSUNION: "TransUnion",
  }

  const STATUS_LABEL: Record<string, string> = {
    LEAD: "Lead", CONTACTED: "Contacted", CONSULT_SCHEDULED: "Consult",
    SIGNED: "Signed", ACTIVE: "Active", PAUSED: "Paused", COMPLETE: "Complete",
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Reports</h1>
          <p className="text-sm text-muted mt-1">Business performance overview — {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        </div>
      </div>

      {/* ── Client Summary ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Client Overview</h2>
        <div className="grid grid-cols-4 gap-4">
          <KPI label="Total clients" value={String(totalClients)} sub={`${newThisMonth} new this month`} />
          <KPI label="Active" value={String(activeClients)} accent="text-success" sub={`${Math.round((activeClients / Math.max(1, totalClients)) * 100)}% of total`} />
          <KPI label="New (last 3 mo)" value={String(newLast3M)} accent="text-primary" />
          <KPI label="Avg. per month" value={String(Math.round(newLast3M / 3))} />
        </div>
      </section>

      {/* Status pipeline */}
      <section className="bg-white rounded-xl border border-secondary-soft p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Client Pipeline</h2>
        <div className="grid grid-cols-7 gap-2 text-center">
          {statusCounts.sort((a, b) => {
            const order = ["LEAD","CONTACTED","CONSULT_SCHEDULED","SIGNED","ACTIVE","PAUSED","COMPLETE"]
            return order.indexOf(a.status) - order.indexOf(b.status)
          }).map(s => (
            <div key={s.status} className="flex flex-col items-center gap-1">
              <p className="text-2xl font-bold text-ink">{s._count._all}</p>
              <p className="text-[10px] text-muted uppercase tracking-wide">{STATUS_LABEL[s.status] ?? s.status}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Monthly trend bar chart */}
      <section className="bg-white rounded-xl border border-secondary-soft p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">New Clients — Last 6 Months</h2>
        <div className="flex items-end gap-3 h-28">
          {months.map(m => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-ink">{m.count || ""}</span>
              <div
                className="w-full bg-primary/80 rounded-t"
                style={{ height: `${Math.round((m.count / maxMonthCount) * 80) + 4}px` }}
              />
              <span className="text-[10px] text-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dispute Outcomes ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Dispute Performance</h2>
        <div className="grid grid-cols-4 gap-4">
          <KPI label="Deletion rate" value={`${deletionRate}%`} accent="text-success" sub={`${deletedItems} deleted / ${totalResolved} resolved`} />
          <KPI label="Removal rate" value={`${removalRate}%`} accent="text-primary" sub="Deleted + Repaired" />
          <KPI label="Open items" value={String(openItems)} accent={openItems > 0 ? "text-warning" : "text-ink"} />
          <KPI label="FCRA overdue" value={String(overdueItems)} accent={overdueItems > 0 ? "text-danger" : "text-ink"} sub={overdueItems > 0 ? "Action required" : "All on track"} />
        </div>
      </section>

      {/* Outcome breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-secondary-soft p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">Outcome Breakdown</h2>
          {[
            { label: "Deleted", count: deletedItems,    color: "bg-success" },
            { label: "Repaired", count: repairedItems,   color: "bg-primary" },
            { label: "Verified", count: verifiedItems,   color: "bg-warning" },
            { label: "No Response", count: noResponseItems, color: "bg-secondary" },
            { label: "Pending", count: openItems,        color: "bg-muted/40" },
          ].map(row => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted">{row.label}</span>
                <span className="font-semibold text-ink">{row.count}</span>
              </div>
              <Bar pct={totalDisputeItems > 0 ? (row.count / totalDisputeItems) * 100 : 0} color={row.color} />
            </div>
          ))}
        </div>

        {/* Bureau breakdown */}
        <div className="bg-white rounded-xl border border-secondary-soft p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">By Bureau</h2>
          {bureauStats.map(b => {
            const deleted = bureauDeletedMap[b.bureau] ?? 0
            const rate = b._count._all > 0 ? Math.round((deleted / b._count._all) * 100) : 0
            return (
              <div key={b.bureau} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{BUREAU_LABEL[b.bureau] ?? b.bureau}</span>
                  <span className="font-semibold text-ink">{deleted} / {b._count._all} ({rate}%)</span>
                </div>
                <Bar pct={rate} color={b.bureau === "EXPERIAN" ? "bg-danger/70" : b.bureau === "EQUIFAX" ? "bg-primary/70" : "bg-success/70"} />
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Letters & Rounds ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Letters &amp; Rounds</h2>
        <div className="grid grid-cols-4 gap-4">
          <KPI label="Total rounds" value={String(totalRounds)} sub={`${roundsThisMonth} this month`} />
          <KPI label="Letters sent" value={String(sentLetters)} accent="text-success" />
          <KPI label="Letters pending" value={String(unsentLetters)} accent={unsentLetters > 0 ? "text-warning" : "text-ink"} />
          <KPI label="Send rate" value={totalLetters > 0 ? `${Math.round((sentLetters / totalLetters) * 100)}%` : "—"} />
        </div>
      </section>

      {/* ── Revenue ─────────────────────────────────────────────────────── */}
      {canBilling && (
        <section>
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Revenue</h2>
          <div className="grid grid-cols-4 gap-4">
            <KPI label="Revenue YTD" value={`$${((revenueYTD as number) / 100).toLocaleString()}`} accent="text-success" />
            <KPI label="This month" value={`$${((revenueThisMonth as number) / 100).toLocaleString()}`} accent="text-success" />
            <KPI label="Active subscriptions" value={String(activeSubscriptions ?? "—")} />
            <KPI label="Open invoices" value={String(openInvoices ?? "—")} accent={openInvoices ? "text-warning" : "text-ink"} />
          </div>
        </section>
      )}

      {/* Quick links */}
      <div className="flex gap-3 text-sm">
        <Link href="/disputes" className="px-4 py-2 rounded-lg border border-secondary-soft text-muted hover:text-ink transition-colors">View Disputes →</Link>
        <Link href="/letters" className="px-4 py-2 rounded-lg border border-secondary-soft text-muted hover:text-ink transition-colors">Print Queue →</Link>
        {canBilling && <Link href="/clients" className="px-4 py-2 rounded-lg border border-secondary-soft text-muted hover:text-ink transition-colors">Client List →</Link>}
      </div>
    </div>
  )
}
