import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import { LOAN_TYPE_LABELS } from "@/lib/loan-utils"

function dollars(cents: number | null | undefined) {
  if (!cents) return "—"
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
}

export default async function FundingLedgerPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:read")) redirect("/dashboard")
  const { orgId } = session.user

  const funded = await db.loanFile.findMany({
    where: { orgId, status: "FUNDED" },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { name: true } },
      processor: { select: { name: true } },
    },
    orderBy: { fundedAt: "desc" },
  })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const thisMonth = funded.filter(f => f.fundedAt && f.fundedAt >= startOfMonth)
  const thisYear = funded.filter(f => f.fundedAt && f.fundedAt >= startOfYear)

  const totalVolumeCents = funded.reduce((s, f) => s + (f.amountApprovedCents ?? f.amountRequestedCents ?? 0), 0)
  const totalCommissionCents = funded.reduce((s, f) => s + (f.commissionCents ?? 0), 0)
  const monthVolumeCents = thisMonth.reduce((s, f) => s + (f.amountApprovedCents ?? f.amountRequestedCents ?? 0), 0)
  const yearCommissionCents = thisYear.reduce((s, f) => s + (f.commissionCents ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/loans" className="text-sm text-muted hover:text-ink transition-colors">← Loan Pipeline</Link>
          </div>
          <h1 className="text-2xl font-semibold text-ink">Funding Ledger</h1>
          <p className="text-sm text-muted mt-1">{funded.length} funded loan{funded.length !== 1 ? "s" : ""} total</p>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Total funded volume</p>
          <p className="text-2xl font-semibold text-ink mt-1">{totalVolumeCents > 0 ? dollars(totalVolumeCents) : "—"}</p>
          <p className="text-xs text-muted mt-0.5">all time</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">This month</p>
          <p className="text-2xl font-semibold text-success mt-1">{monthVolumeCents > 0 ? dollars(monthVolumeCents) : "—"}</p>
          <p className="text-xs text-muted mt-0.5">{thisMonth.length} file{thisMonth.length !== 1 ? "s" : ""} funded</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Commission (YTD)</p>
          <p className="text-2xl font-semibold text-primary mt-1">{yearCommissionCents > 0 ? dollars(yearCommissionCents) : "—"}</p>
          <p className="text-xs text-muted mt-0.5">{thisYear.length} file{thisYear.length !== 1 ? "s" : ""} this year</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Total commission</p>
          <p className="text-2xl font-semibold text-ink mt-1">{totalCommissionCents > 0 ? dollars(totalCommissionCents) : "—"}</p>
          <p className="text-xs text-muted mt-0.5">all time</p>
        </div>
      </div>

      {funded.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-secondary-soft p-16 text-center">
          <p className="text-muted">No funded loans yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Client</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Type</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Funded amount</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Rate / Term</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Lender</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Processor</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Commission</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Funded date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {funded.map(f => (
                <tr key={f.id} className="hover:bg-secondary-soft/30">
                  <td className="px-5 py-3">
                    <Link href={`/loans/${f.id}`} className="text-primary hover:underline font-medium">
                      {f.client.firstName} {f.client.lastName}
                    </Link>
                    {f.creditScoreAtConversion && (
                      <p className="text-xs text-muted mt-0.5">Score at conversion: {f.creditScoreAtConversion}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted">{LOAN_TYPE_LABELS[f.type]}</td>
                  <td className="px-5 py-3 font-semibold text-ink">
                    {dollars(f.amountApprovedCents ?? f.amountRequestedCents)}
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    {f.interestRate ? `${Number(f.interestRate).toFixed(2)}%` : "—"}
                    {f.termMonths ? ` / ${f.termMonths}mo` : ""}
                  </td>
                  <td className="px-5 py-3 text-muted">{f.lender?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{f.processor?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    {f.commissionCents ? (
                      <span className="font-semibold text-success">{dollars(f.commissionCents)}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    {f.fundedAt ? f.fundedAt.toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            {funded.length > 1 && (
              <tfoot className="bg-secondary-soft/30 border-t-2 border-secondary-soft">
                <tr>
                  <td className="px-5 py-3 text-xs font-semibold text-muted" colSpan={2}>
                    Total ({funded.length} files)
                  </td>
                  <td className="px-5 py-3 font-semibold text-ink">{dollars(totalVolumeCents)}</td>
                  <td colSpan={3} />
                  <td className="px-5 py-3 font-semibold text-success">{dollars(totalCommissionCents)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
