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

export default async function LoansPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:read")) redirect("/dashboard")

  const now = new Date()

  const loanFiles = await db.loanFile.findMany({
    include: {
      client: { select: { firstName: true, lastName: true } },
      lender: { select: { name: true } },
      processor: { select: { name: true } },
      conditions: { where: { status: "OPEN" }, select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Loan Processing</h1>
          <p className="text-muted text-sm mt-1">{loanFiles.length} total files</p>
        </div>
        {canWrite && (
          <Link
            href="/loans/new"
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            + New Loan File
          </Link>
        )}
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
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Open conditions</p>
          <p className="text-2xl font-semibold text-ink mt-1">
            {loanFiles.reduce((s, f) => s + f.conditions.length, 0)}
          </p>
          <p className="text-xs text-muted mt-0.5">awaiting clearance</p>
        </div>
      </div>

      {/* Pipeline stage label */}
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Pipeline</h2>

      {/* Pipeline stage columns (horizontal scroll) */}
      <div className="overflow-x-auto pb-4">
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
                      <p className="text-xs text-muted mt-0.5">{LOAN_TYPE_LABELS[f.type]}</p>
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
      </div>

      {/* Terminated files table */}
      {terminated.length > 0 && (
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
