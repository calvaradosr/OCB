import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import ProcessorPanel from "./ProcessorPanel"

export default async function LendersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:read")) redirect("/dashboard")

  const { tab } = await searchParams
  const activeTab = tab === "processors" ? "processors" : "lenders"
  const canWrite = can(session.user.role, "loans:write")
  const canManage = can(session.user.role, "users:manage")

  const [lenders, processors] = await Promise.all([
    db.lender.findMany({
      include: { _count: { select: { loanFiles: true } } },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: { in: ["LOAN_PROCESSOR", "MANAGER", "ADMIN"] }, active: true },
      include: { _count: { select: { loanFiles: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  const tabClass = (t: string) =>
    t === activeTab
      ? "px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary"
      : "px-4 py-2 text-sm text-muted hover:text-ink border-b-2 border-transparent"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Loan Team</h1>
          <p className="text-muted text-sm mt-1">Manage lenders and loan processors</p>
        </div>
        {activeTab === "lenders" && canWrite && (
          <Link
            href="/lenders/new"
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            + Add Lender
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-secondary-soft flex gap-0">
        <Link href="/lenders?tab=lenders" className={tabClass("lenders")}>
          Lenders
          <span className="ml-1.5 text-xs font-normal text-muted">({lenders.length})</span>
        </Link>
        <Link href="/lenders?tab=processors" className={tabClass("processors")}>
          Processors
          <span className="ml-1.5 text-xs font-normal text-muted">({processors.length})</span>
        </Link>
      </div>

      {/* Lenders tab */}
      {activeTab === "lenders" && (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          {lenders.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-muted text-sm">No lenders yet.</p>
              {canWrite && (
                <Link href="/lenders/new" className="mt-2 inline-block text-sm text-primary hover:underline">
                  Add your first lender
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary-soft/50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs text-muted font-medium">Lender</th>
                  <th className="px-5 py-3 text-left text-xs text-muted font-medium">Contact</th>
                  <th className="px-5 py-3 text-left text-xs text-muted font-medium">Programs</th>
                  <th className="px-5 py-3 text-left text-xs text-muted font-medium">Min. Score</th>
                  <th className="px-5 py-3 text-left text-xs text-muted font-medium">Files</th>
                  <th className="px-5 py-3 text-left text-xs text-muted font-medium">Status</th>
                  {canWrite && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-soft">
                {lenders.map(l => (
                  <tr key={l.id} className="hover:bg-secondary-soft/30">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{l.name}</p>
                      {l.submissionNotes && (
                        <p className="text-xs text-muted mt-0.5 truncate max-w-48">{l.submissionNotes}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {l.contactName && <p>{l.contactName}</p>}
                      {l.contactEmail && (
                        <a href={`mailto:${l.contactEmail}`} className="text-xs text-primary hover:underline">
                          {l.contactEmail}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {l.programs.map(p => (
                          <span key={p} className="text-xs bg-secondary-soft text-ink px-1.5 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">{l.minCreditScore ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">{l._count.loanFiles}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium ${l.active ? "text-success" : "text-muted"}`}>
                        {l.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3">
                        <Link href={`/lenders/${l.id}/edit`} className="text-xs text-primary hover:underline">
                          Edit
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Processors tab */}
      {activeTab === "processors" && (
        <ProcessorPanel
          processors={processors.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email,
            active: p.active,
            _count: p._count,
          }))}
          canManage={canManage}
        />
      )}
    </div>
  )
}
