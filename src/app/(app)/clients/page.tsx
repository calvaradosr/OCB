import Link from "next/link"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { StatusBadge } from "@/components/StatusBadge"
import { CLIENT_STATUSES, STATUS_LABELS } from "@/lib/client-utils"

const PAGE_SIZE = 25

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; agent?: string; page?: string }>
}) {
  const session = (await auth())!
  const { q, status, agent, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10))

  const where = {
    orgId: "ocb",
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status && status !== "ALL" ? { status } : {}),
    ...(agent ? { assignedAgentId: agent } : {}),
  }

  const [clients, total, agents] = await Promise.all([
    db.client.findMany({
      where,
      include: { assignedAgent: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.client.count({ where }),
    db.user.findMany({
      where: { role: { in: ["AGENT", "MANAGER", "ADMIN"] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canWrite = can(session.user.role, "clients:write")

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Clients</h1>
          <p className="text-sm text-muted">{total} total</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/api/clients/export"
            className="rounded-lg border border-secondary-soft px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
          >
            Export CSV
          </a>
          {canWrite && (
            <Link
              href="/clients/new"
              className="rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              + New client
            </Link>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-secondary-soft">
        {(["ALL", ...CLIENT_STATUSES] as const).map(s => {
          const params = new URLSearchParams({ ...(q ? { q } : {}), ...(agent ? { agent } : {}), status: s === "ALL" ? "" : s })
          return (
            <a
              key={s}
              href={`/clients?${params}`}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                (status ?? "ALL") === s
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_LABELS[s]}
            </a>
          )
        })}
      </div>

      {/* Filters */}
      <form method="GET" action="/clients" className="flex gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          className="flex-1 max-w-xs rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <select
          name="agent"
          defaultValue={agent ?? ""}
          className="rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All agents</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {status && <input type="hidden" name="status" value={status} />}
        <button
          type="submit"
          className="rounded-lg bg-secondary-soft px-4 py-2 text-sm text-ink hover:bg-secondary transition-colors"
        >
          Filter
        </button>
        {(q || agent) && (
          <a href={`/clients${status ? `?status=${status}` : ""}`} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-ink transition-colors">
            Clear
          </a>
        )}
      </form>

      {/* Table */}
      {clients.length === 0 ? (
        <div className="rounded-xl border border-secondary-soft bg-white p-12 text-center">
          <p className="text-muted text-sm">No clients found. {canWrite && <Link href="/clients/new" className="text-primary hover:underline">Add one?</Link>}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-secondary-soft bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary-soft bg-canvas">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {clients.map(c => (
                <tr key={c.id} className="hover:bg-canvas transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{c.assignedAgent?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-primary hover:text-primary-dark text-xs font-medium"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/clients?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page - 1) })}`}
                className="rounded-lg border border-secondary-soft px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/clients?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(page + 1) })}`}
                className="rounded-lg border border-secondary-soft px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
