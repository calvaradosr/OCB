import { getPortalClient } from "@/lib/portal"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { DisputeOutcome } from "@prisma/client"
import ScoreTrendChart from "./ScoreTrendChart"

export default async function PortalDashboard() {
  const { client, session } = await getPortalClient()

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "PortalDashboard",
    entityId: client.id,
  }).catch(() => {})

  // Latest report scores
  const reports = await db.creditReport.findMany({
    where: { clientId: client.id },
    orderBy: { pulledAt: "asc" },
  })

  const latestReport = reports.at(-1)

  // Dispute summary
  const allDisputeItems = await db.disputeItem.findMany({
    where: { dispute: { clientId: client.id } },
    select: { outcome: true, dispute: { select: { round: true } } },
  })

  const totalDisputed = allDisputeItems.length
  const totalDeleted = allDisputeItems.filter(d => d.outcome === DisputeOutcome.DELETED).length
  const totalRepaired = allDisputeItems.filter(d => d.outcome === DisputeOutcome.REPAIRED).length
  const currentRound = Math.max(0, ...allDisputeItems.map(d => d.dispute.round))

  // Pending agreements
  const pendingAgreements = await db.agreement.findMany({
    where: { clientId: client.id, status: "PENDING" },
    select: { id: true, type: true },
  })

  // Score data for chart (per bureau, chronological)
  const scoreData = reports.map(r => ({
    date: r.pulledAt.toISOString().slice(0, 10),
    experian: r.scoreExperian,
    equifax: r.scoreEquifax,
    transunion: r.scoreTransunion,
  }))

  const deletionRate = totalDisputed > 0 ? Math.round(((totalDeleted + totalRepaired) / totalDisputed) * 100) : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Welcome back, {client.firstName}
        </h1>
        <p className="text-muted mt-1">Here&apos;s your credit repair progress.</p>
      </div>

      {pendingAgreements.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <p className="text-sm font-medium text-warning">Action required</p>
          <p className="text-sm text-ink mt-1">
            You have {pendingAgreements.length} document{pendingAgreements.length > 1 ? "s" : ""} awaiting your signature.
          </p>
          <div className="mt-2 flex gap-2 flex-wrap">
            {pendingAgreements.map(a => (
              <a
                key={a.id}
                href={`/portal/sign/${a.id}`}
                className="inline-block px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-dark transition-colors"
              >
                Sign {a.type.replace(/_/g, " ")}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Progress hero — the most prominent CRC parity element */}
      {totalDisputed > 0 && (
        <div className="bg-white rounded-xl border border-secondary-soft p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink">Removal Progress</h2>
            <span className="text-2xl font-bold text-success">{deletionRate}%</span>
          </div>
          <div className="w-full bg-secondary-soft rounded-full h-4 mb-3">
            <div
              className="h-4 rounded-full bg-success transition-all"
              style={{ width: `${deletionRate}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{totalDeleted + totalRepaired} items removed or repaired</span>
            <span>{totalDisputed} total in blocking</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-secondary-soft">
            <div className="text-center">
              <p className="text-xl font-bold text-success">{totalDeleted}</p>
              <p className="text-xs text-muted">Deleted</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{totalRepaired}</p>
              <p className="text-xs text-muted">Repaired</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-ink">{currentRound || "—"}</p>
              <p className="text-xs text-muted">Round</p>
            </div>
          </div>
        </div>
      )}

      {/* Score summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(["TransUnion", "Experian", "Equifax"] as const).map(bureau => {
          const key = `score${bureau}` as "scoreExperian" | "scoreEquifax" | "scoreTransunion"
          const score = latestReport?.[key]
          const prevReport = reports.at(-2)
          const prevScore = prevReport?.[key]
          const change = score && prevScore ? score - prevScore : null
          return (
            <div key={bureau} className="bg-white rounded-lg border border-secondary-soft p-5">
              <p className="text-xs text-muted uppercase tracking-wide">{bureau}</p>
              <p className={`text-4xl font-bold mt-1 ${
                score && score >= 740 ? "text-success" : score && score >= 670 ? "text-primary" : score && score >= 580 ? "text-warning" : "text-ink"
              }`}>
                {score ?? "—"}
              </p>
              {change !== null && (
                <p className={`text-xs font-medium mt-1 ${change > 0 ? "text-success" : change < 0 ? "text-danger" : "text-muted"}`}>
                  {change > 0 ? `+${change}` : change} pts
                </p>
              )}
              <p className="text-xs text-muted mt-1">
                {latestReport ? `As of ${latestReport.pulledAt.toLocaleDateString()}` : "No report yet"}
              </p>
            </div>
          )
        })}
      </div>

      {/* Score trend chart (client component) */}
      {scoreData.length > 1 && (
        <div className="bg-white rounded-lg border border-secondary-soft p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Score Trend</h2>
          <ScoreTrendChart data={scoreData} />
        </div>
      )}

      {totalDisputed === 0 && (
        <div className="bg-secondary-soft/30 rounded-xl border border-secondary-soft p-8 text-center">
          <p className="text-sm font-medium text-ink">No blocks on file yet</p>
          <p className="text-xs text-muted mt-1">Your specialist will begin the blocking process after reviewing your credit report.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color?: "success" | "primary"
}) {
  const valueClass =
    color === "success"
      ? "text-success"
      : color === "primary"
      ? "text-primary"
      : "text-ink"

  return (
    <div className="bg-white rounded-lg border border-secondary-soft p-4">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${valueClass}`}>{value}</p>
    </div>
  )
}
