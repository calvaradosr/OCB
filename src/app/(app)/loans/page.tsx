import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import {
  LOAN_STATUS_LABELS,
  LOAN_STATUS_COLORS,
  LOAN_TYPE_LABELS,
  PIPELINE_STAGES,
} from "@/lib/loan-utils"
import { LoanStatus } from "@prisma/client"

function dollars(cents: number | null) {
  if (!cents) return "—"
  return `$${(cents / 100).toLocaleString()}`
}

function daysInStage(statusChangedAt: Date) {
  const days = Math.floor((Date.now() - statusChangedAt.getTime()) / (1000 * 60 * 60 * 24))
  return days === 0 ? "Today" : `${days}d`
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; view?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:read")) redirect("/dashboard")

  const { clientId, view } = await searchParams
  const isMyQueue = view === "mine"
  const now = new Date()

  // For processor queue: show only files assigned to the current user
  const processorFilter = isMyQueue ? { processorId: session.user.id } : {}
  const clientFilter = clientId ? { clientId } : {}

  const where = { ...processorFilter, ...clientFilter }

  const loanFiles = await db.loanFile.findMany({
    where,
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { name: true } },
      processor: { select: { name: true } },
      conditions: { where: { status: "OPEN" }, select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  // If viewing a specific client, load their name for the header
  const clientName = clientId
    ? await db.client.findUnique({ where: { id: clientId }, select: { firstName: true, lastName: true } })
    : null

  // Group by status for the pipeline view
  const grouped = PIPELINE_STAGES.reduce<Record<LoanStatus, typeof loanFiles>>(
    (acc, s) => { acc[s] = []; return acc },
    {} as Record<LoanStatus, typeof loanFiles>
  )
  const terminated: typeof loanFiles = []

  for (const f of loanFiles) {
    if (grouped[f.status]) {
      grouped[f.status].push(f)
    } else {
      terminated.push(f)
    }
  }

  const canWrite = can(session.user.role, "loans:write")
  const isProcessor = session.user.role === "LOAN_PROCESSOR"

  // KPI stats
  const totalPipelineCents = loanFiles
    .filter(f => PIPELINE_STAGES.includes(f.status))
    .reduce((sum, f) => sum + (f.amountRequestedCents ?? 0), 0)

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const fundedThisMonth = loanFiles.filter(
    f => f.status === "FUNDED" && f.statusChangedAt >= startOfMonth
  )
  const fundedValueCents = fundedThisMonth.reduce((s, f) => s + (f.amountRequestedCents ?? 0), 0)

  const activeFiles = loanFiles.filter(f => PIPELINE_STAGES.includes(f.status)).length

  const openConditions = loanFiles.reduce((s, f) => s + f.conditions.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {clientName ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/loans" className="text-sm text-muted hover:text-ink transition-colors">← All loans</Link>
              </div>
              <h1 className="text-2xl font-semibold text-ink">
                {clientName.firstName} {clientName.lastName} — Loan Files
              </h1>
            </>
          ) : isMyQueue ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/loans" className="text-sm text-muted hover:text-ink transition-colors">← All loans</Link>
              </div>
              <h1 className="text-2xl font-semibold text-ink">My Queue</h1>
              <p className="text-muted text-sm mt-0.5">Files assigned to you</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-ink">Loan Processing</h1>
              <p className="text-muted text-sm mt-1">{loanFiles.length} total files</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Processor queue shortcut */}
          {(isProcessor || can(session.user.role, "loans:write")) && !isMyQueue && !clientId && (
            <Link
              href="/loans?view=mine"
              className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors"
            >
              My Queue {openConditions > 0 ? `(${openConditions} cond.)` : ""}
            </Link>
          )}
          {!clientId && !isMyQueue && (
            <Link
              href="/loans/funded"
              className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors"
            >
              Funding Ledger
            </Link>
          )}
          {canWrite && !clientId && (
            <Link
              href="/loans/new"
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              + New Loan File
            </Link>
          )}
          {canWrite && clientId && (
            <Link
              href={`/loans/new?clientId=${clientId}`}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              + New Loan File
            </Link>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Active pipeline</p>
          <p className="text-2xl font-semibold text-ink mt-1">{activeFiles}</p>
          <p className="text-xs text-muted mt-0.5">files in progress</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Pipeline value</p>
          <p className="text-2xl font-semibold text-ink mt-1">
            {totalPipelineCents > 0 ? `$${(totalPipelineCents / 100).toLocaleString()}` : "—"}
          </p>
          <p className="text-xs text-muted mt-0.5">active requests</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Funded this month</p>
          <p className="text-2xl font-semibold text-success mt-1">
            {fundedThisMonth.length > 0 ? `$${(fundedValueCents / 100).toLocaleString()}` : "—"}
          </p>
          <p className="text-xs text-muted mt-0.5">{fundedThisMonth.length} files closed</p>
        </div>
        <div className={`bg-white rounded-xl border p-5 ${openConditions > 0 ? "border-warning/40" : "border-secondary-soft"}`}>
          <p className="text-xs text-muted">Open conditions</p>
          <p className={`text-2xl font-semibold mt-1 ${openConditions > 0 ? "text-warning" : "text-ink"}`}>
            {openConditions}
          </p>
          <p className="text-xs text-muted mt-0.5">awaiting clearance</p>
        </div>
      </div>

      {/* My Queue: flat list with conditions highlighted */}
      {isMyQueue && (
        <div className="space-y-3">
          {loanFiles.filter(f => PIPELINE_STAGES.includes(f.status)).length === 0 ? (
            <div className="border-2 border-dashed border-secondary-soft rounded-xl p-12 text-center">
              <p className="text-muted text-sm">No active files assigned to you.</p>
            </div>
          ) : (
            loanFiles
              .filter(f => PIPELINE_STAGES.includes(f.status))
              .sort((a, b) => b.conditions.length - a.conditions.length)
              .map(f => {
                const colors = LOAN_STATUS_COLORS[f.status]
                return (
                  <Link
                    key={f.id}
                    href={`/loans/${f.id}`}
                    className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-ink">
                          {f.client.firstName} {f.client.lastName}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {LOAN_TYPE_LABELS[f.type]}
                          {f.lender ? ` · ${f.lender.name}` : ""}
                          {f.amountRequestedCents ? ` · ${dollars(f.amountRequestedCents)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {f.conditions.length > 0 && (
                        <span className="text-xs font-semibold bg-warning/10 text-warning px-2.5 py-1 rounded-full">
                          {f.conditions.length} open condition{f.conditions.length > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                        {LOAN_STATUS_LABELS[f.status]}
                      </span>
                      <span className="text-xs text-muted">{daysInStage(f.statusChangedAt)}</span>
                    </div>
                  </Link>
                )
              })
          )}
        </div>
      )}

      {/* Pipeline stage label */}
      {!isMyQueue && <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Pipeline</h2>}

      {/* Pipeline stage columns (horizontal scroll) */}
      {!isMyQueue && <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {PIPELINE_STAGES.map(status => {
            const files = grouped[status]
            const colors = LOAN_STATUS_COLORS[status]
            return (
              <div key={status} className="w-64 shrink-0">
                <div className={`flex items-center justify-between mb-2 px-2 py-1.5 rounded ${colors.bg}`}>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                    {LOAN_STATUS_LABELS[status]}
                  </span>
                  <span className={`text-xs font-bold ${colors.text}`}>{files.length}</span>
                </div>

                <div className="space-y-2">
                  {files.map(f => (
                    <Link
                      key={f.id}
                      href={`/loans/${f.id}`}
                      className="block bg-white border border-secondary-soft rounded-lg p-3 hover:border-primary transition-colors"
                    >
                      <p className="text-sm font-medium text-ink truncate">
                        {f.client.firstName} {f.client.lastName}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <p className="text-xs text-muted">{LOAN_TYPE_LABELS[f.type]}</p>
                        {f.creditScoreAtConversion && (
                          <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-medium">
                            CR Bridge ↗
                          </span>
                        )}
                      </div>
                      {f.amountRequestedCents && (
                        <p className="text-xs font-semibold text-primary mt-1">
                          {dollars(f.amountRequestedCents)}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        {f.lender && (
                          <span className="text-xs text-muted truncate">{f.lender.name}</span>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          {f.conditions.length > 0 && (
                            <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded">
                              {f.conditions.length} cond.
                            </span>
                          )}
                          <span className="text-xs text-muted">{daysInStage(f.statusChangedAt)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {files.length === 0 && (
                    <div className="border-2 border-dashed border-secondary-soft rounded-lg p-4 text-center">
                      <p className="text-xs text-muted">Empty</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>}

      {/* Terminated files table */}
      {!isMyQueue && terminated.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Closed / Declined / Withdrawn
          </h2>
          <div className="bg-white rounded-lg border border-secondary-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary-soft/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Client</th>
                  <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Type</th>
                  <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Amount</th>
                  <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Lender</th>
                  <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-soft">
                {terminated.map(f => {
                  const colors = LOAN_STATUS_COLORS[f.status]
                  return (
                    <tr key={f.id} className="hover:bg-secondary-soft/30">
                      <td className="px-5 py-3">
                        <Link href={`/loans/${f.id}`} className="text-primary hover:underline">
                          {f.client.firstName} {f.client.lastName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted">{LOAN_TYPE_LABELS[f.type]}</td>
                      <td className="px-5 py-3 text-muted">{dollars(f.amountRequestedCents)}</td>
                      <td className="px-5 py-3 text-muted">{f.lender?.name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                          {LOAN_STATUS_LABELS[f.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
