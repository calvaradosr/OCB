import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"

export default async function LendersPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:read")) redirect("/dashboard")

  const lenders = await db.lender.findMany({
    include: { _count: { select: { loanFiles: true } } },
    orderBy: { name: "asc" },
  })

  const canWrite = can(session.user.role, "loans:write")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Lender Directory</h1>
          <p className="text-muted text-sm mt-1">{lenders.length} lenders</p>
        </div>
        {canWrite && (
          <Link
            href="/lenders/new"
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            + Add Lender
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        {lenders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-muted text-sm">No lenders yet. Add your first lender to get started.</p>
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
    </div>
  )
}
