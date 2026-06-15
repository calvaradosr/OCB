import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"

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
    include: { _count: { select: { items: true } } },
    orderBy: { pulledAt: "desc" },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <span className="text-ink font-medium">Reports</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Credit Reports</h1>
        <Link
          href={`/clients/${id}/reports/import`}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90"
        >
          + Import Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="border border-dashed border-secondary-soft rounded-lg p-12 text-center">
          <p className="text-muted text-sm">No credit reports imported yet.</p>
          <Link
            href={`/clients/${id}/reports/import`}
            className="mt-3 inline-block text-primary text-sm hover:underline"
          >
            Import the first report →
          </Link>
        </div>
      ) : (
        <div className="border border-secondary-soft rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-secondary-soft/30">
              <tr className="text-xs text-muted uppercase tracking-wide">
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-left">Source</th>
                <th className="py-3 px-4 text-center">Experian</th>
                <th className="py-3 px-4 text-center">Equifax</th>
                <th className="py-3 px-4 text-center">TransUnion</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-secondary-soft/10">
                  <td className="py-3 px-4 text-ink">
                    {r.pulledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {r.source.replace(/_/g, " ")}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.scoreExperian ? (
                      <ScorePill score={r.scoreExperian} />
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.scoreEquifax ? (
                      <ScorePill score={r.scoreEquifax} />
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.scoreTransunion ? (
                      <ScorePill score={r.scoreTransunion} />
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center text-muted">{r._count.items}</td>
                  <td className="py-3 px-4 text-right">
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
    </div>
  )
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 670 ? "text-success bg-success/10" :
    score >= 580 ? "text-warning bg-warning/10" :
    "text-danger bg-danger/10"
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {score}
    </span>
  )
}
