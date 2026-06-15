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

      {/* Score summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(["Experian", "Equifax", "TransUnion"] as const).map(bureau => {
          const key = `score${bureau}` as "scoreExperian" | "scoreEquifax" | "scoreTransunion"
          const score = latestReport?.[key]
          return (
            <div key={bureau} className="bg-white rounded-lg border border-secondary-soft p-5">
              <p className="text-xs text-muted uppercase tracking-wide">{bureau}</p>
              <p className="text-4xl font-bold text-ink mt-1">
                {score ?? "—"}
              </p>
              <p className="text-xs text-muted mt-1">
                {latestReport ? `As of ${latestReport.pulledAt.toLocaleDateString()}` : "No report yet"}
              </p>
            </div>
          )
        })}
      </div>

      {/* Dispute stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Items Disputed" value={totalDisputed} />
        <StatCard label="Deleted" value={totalDeleted} color="success" />
        <StatCard label="Repaired" value={totalRepaired} color="primary" />
        <StatCard label="Current Round" value={currentRound || "—"} />
      </div>

      {/* Score trend chart (client component) */}
      {scoreData.length > 1 && (
        <div className="bg-white rounded-lg border border-secondary-soft p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Score Trend</h2>
          <ScoreTrendChart data={scoreData} />
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
