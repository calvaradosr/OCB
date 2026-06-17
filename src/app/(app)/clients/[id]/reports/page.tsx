import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 740 ? "text-success bg-success/10" :
    score >= 670 ? "text-primary bg-primary/10" :
    score >= 580 ? "text-warning bg-warning/10" :
    "text-danger bg-danger/10"
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {score}
    </span>
  )
}

function ScoreSparkline({
  values,
  color,
}: {
  values: (number | null | undefined)[]
  color: string
}) {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length < 2) return null
  const min = Math.min(...valid) - 20
  const max = Math.max(...valid) + 20
  const W = 80, H = 32
  const points = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * W
    const y = H - ((v - min) / (max - min)) * H
    return `${x},${y}`
  }).join(" ")
  const delta = valid[valid.length - 1] - valid[0]
  return (
    <div className="flex items-center gap-2">
      <svg width={W} height={H} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {valid.map((v, i) => (
          <circle
            key={i}
            cx={(i / (valid.length - 1)) * W}
            cy={H - ((v - min) / (max - min)) * H}
            r="3"
            fill={color}
          />
        ))}
      </svg>
      {delta !== 0 && (
        <span className={`text-xs font-medium ${delta > 0 ? "text-success" : "text-danger"}`}>
          {delta > 0 ? "+" : ""}{delta}
        </span>
      )}
    </div>
  )
}

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  const reports = await db.creditReport.findMany({
    where: { clientId: id },
    include: {
      _count: { select: { items: true } },
      items: { where: { flagged: true }, select: { id: true } },
    },
    orderBy: { pulledAt: "desc" },
  })

  // Get all flagged item counts and dispute status
  const disputeItemCounts = await db.disputeItem.groupBy({
    by: ["outcome"],
    where: { item: { clientId: id } },
    _count: { _all: true },
  })

  const deletedCount = disputeItemCounts.find(d => d.outcome === "DELETED")?._count._all ?? 0
  const inDisputeCount = disputeItemCounts.find(d => d.outcome === "PENDING")?._count._all ?? 0

  const totalItems = await db.reportItem.count({ where: { clientId: id } })
  const flaggedItems = await db.reportItem.count({ where: { clientId: id, flagged: true } })

  const latestReport = reports[0]

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <span className="text-ink font-medium">Credit Reports</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Credit Reports</h1>
          <p className="text-sm text-muted mt-0.5">{reports.length} report{reports.length !== 1 ? "s" : ""} on file</p>
        </div>
        <Link
          href={`/clients/${id}/reports/import`}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          + Import Report
        </Link>
      </div>

      {/* Latest scores + trend */}
      {latestReport && (
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">Credit Scores</h2>
            <span className="text-xs text-muted">
              Latest: {latestReport.pulledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Experian", score: latestReport.scoreExperian, history: reports.map(r => r.scoreExperian).reverse(), color: "#A8862B" },
              { label: "Equifax", score: latestReport.scoreEquifax, history: reports.map(r => r.scoreEquifax).reverse(), color: "#22c55e" },
              { label: "TransUnion", score: latestReport.scoreTransunion, history: reports.map(r => r.scoreTransunion).reverse(), color: "#3b82f6" },
            ].map(({ label, score, history, color }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-muted uppercase tracking-widest mb-2">{label}</p>
                {score ? (
                  <p className={`text-3xl font-bold ${
                    score >= 740 ? "text-success" : score >= 670 ? "text-primary" : score >= 580 ? "text-warning" : "text-danger"
                  }`}>{score}</p>
                ) : (
                  <p className="text-2xl font-bold text-muted">—</p>
                )}
                {reports.length >= 2 && (
                  <div className="flex justify-center mt-2">
                    <ScoreSparkline values={history} color={color} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-secondary-soft flex items-center gap-6 text-sm">
            <span className="text-muted">{totalItems} total items</span>
            {flaggedItems > 0 && <span className="text-warning font-medium">{flaggedItems} flagged</span>}
            {inDisputeCount > 0 && <span className="text-primary font-medium">{inDisputeCount} in dispute</span>}
            {deletedCount > 0 && <span className="text-success font-medium">{deletedCount} deleted</span>}
            <div className="flex-1" />
            <Link
              href={`/clients/${id}/reports/${latestReport.id}`}
              className="text-primary hover:underline text-sm"
            >
              View full item grid →
            </Link>
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-white border border-dashed border-secondary-soft rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary-soft flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
          </div>
          <p className="font-semibold text-ink mb-1">No credit reports yet</p>
          <p className="text-sm text-muted mb-4">Import the client&apos;s credit report to start the dispute workflow.</p>
          <Link
            href={`/clients/${id}/reports/import`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Import first report →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <div className="bg-secondary-soft/30 px-5 py-3 border-b border-secondary-soft">
            <h2 className="font-semibold text-ink text-sm">Report History</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="border-b border-secondary-soft">
              <tr className="text-xs text-muted uppercase tracking-wide">
                <th className="py-3 px-5 text-left">Date</th>
                <th className="py-3 px-5 text-left">Source</th>
                <th className="py-3 px-5 text-center">Experian</th>
                <th className="py-3 px-5 text-center">Equifax</th>
                <th className="py-3 px-5 text-center">TransUnion</th>
                <th className="py-3 px-5 text-center">Items</th>
                <th className="py-3 px-5 text-center">Flagged</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {reports.map((r, i) => (
                <tr key={r.id} className={`hover:bg-secondary-soft/10 ${i === 0 ? "bg-primary/[0.02]" : ""}`}>
                  <td className="py-3 px-5 text-ink font-medium">
                    {r.pulledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {i === 0 && <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Latest</span>}
                  </td>
                  <td className="py-3 px-5 text-muted text-xs">
                    {r.source.replace(/_/g, " ")}
                  </td>
                  <td className="py-3 px-5 text-center">
                    {r.scoreExperian ? <ScorePill score={r.scoreExperian} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 px-5 text-center">
                    {r.scoreEquifax ? <ScorePill score={r.scoreEquifax} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 px-5 text-center">
                    {r.scoreTransunion ? <ScorePill score={r.scoreTransunion} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 px-5 text-center text-muted">{r._count.items}</td>
                  <td className="py-3 px-5 text-center">
                    {r.items.length > 0 ? (
                      <span className="text-warning text-xs font-medium">{r.items.length}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <Link
                      href={`/clients/${id}/reports/${r.id}`}
                      className="text-primary text-sm hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick action: start dispute if reports exist */}
      {reports.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-secondary-soft p-4">
          <p className="text-sm text-muted">Ready to dispute? Select flagged items and generate letters.</p>
          <Link
            href={`/clients/${id}/disputes/new`}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Start Dispute Wizard →
          </Link>
        </div>
      )}
    </div>
  )
}
