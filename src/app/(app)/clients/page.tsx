import Link from "next/link"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { StatusBadge } from "@/components/StatusBadge"
import { CLIENT_STATUSES, STATUS_LABELS, type ClientStatus } from "@/lib/client-utils"
import KanbanBoard from "./KanbanBoard"
import { InlineStatusSelect } from "@/components/InlineStatusSelect"

const PAGE_SIZE = 25

function ScorePill({ score }: { score: number | null | undefined }) {
  if (!score) return <span className="text-muted text-xs">—</span>
  const color =
    score >= 740 ? "text-success" :
    score >= 670 ? "text-primary" :
    score >= 580 ? "text-warning" :
    "text-danger"
  return <span className={`text-sm font-bold ${color}`}>{score}</span>
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; agent?: string; page?: string; view?: string }>
}) {
  const session = (await auth())!
  const { orgId } = session.user
  const { q, status, agent, page: pageStr, view } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10))
  const isKanban = view === "kanban"

  const where = {
    orgId,
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

  const [clients, total, agents, statusCounts] = await Promise.all([
    db.client.findMany({
      where,
      include: { assignedAgent: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.client.count({ where }),
    db.user.findMany({
      where: { orgId, role: { in: ["AGENT", "MANAGER", "ADMIN"] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.client.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { _all: true },
    }),
  ])

  const countByStatus = Object.fromEntries(statusCounts.map(s => [s.status, s._count._all]))
  const totalAll = Object.values(countByStatus).reduce((a, b) => a + b, 0)

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canWrite = can(session.user.role, "clients:write")

  // Batch-fetch latest credit report scores per client
  const clientIds = clients.map(c => c.id)
  const [latestReports, latestDisputes] = await Promise.all([
    db.creditReport.findMany({
      where: { clientId: { in: clientIds } },
      orderBy: { pulledAt: "desc" },
      distinct: ["clientId"],
      select: {
        clientId: true,
        scoreExperian: true,
        scoreEquifax: true,
        scoreTransunion: true,
        pulledAt: true,
      },
    }),
    db.dispute.findMany({
      where: { clientId: { in: clientIds } },
      orderBy: { round: "desc" },
      distinct: ["clientId"],
      select: {
        clientId: true,
        round: true,
        createdAt: true,
        items: { select: { outcome: true, sentAt: true, dueAt: true } },
      },
    }),
  ])

  const reportMap = new Map(latestReports.map(r => [r.clientId, r]))
  const disputeMap = new Map(latestDisputes.map(d => [d.clientId, d]))

  // Kanban view — fetch all clients (no pagination) for drag-drop pipeline
  if (isKanban) {
    const allClients = await db.client.findMany({
      where: { orgId },
      include: { assignedAgent: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    })
    const allIds = allClients.map(c => c.id)
    const [kanbanReports, kanbanDisputes] = await Promise.all([
      db.creditReport.findMany({
        where: { clientId: { in: allIds } },
        orderBy: { pulledAt: "desc" },
        distinct: ["clientId"],
        select: { clientId: true, scoreExperian: true, scoreEquifax: true, scoreTransunion: true },
      }),
      db.dispute.findMany({
        where: { clientId: { in: allIds } },
        orderBy: { createdAt: "desc" },
        distinct: ["clientId"],
        select: { clientId: true, createdAt: true },
      }),
    ])
    const krMap = new Map(kanbanReports.map(r => [r.clientId, r]))
    const kdMap = new Map(kanbanDisputes.map(d => [d.clientId, d]))

    const kanbanClients = allClients.map(c => {
      const r = krMap.get(c.id)
      const bestScore = r
        ? Math.max(r.scoreExperian ?? 0, r.scoreEquifax ?? 0, r.scoreTransunion ?? 0) || null
        : null
      const lastActivity = kdMap.get(c.id)?.createdAt ?? new Date(c.createdAt)
      const daysSinceActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        status: c.status as ClientStatus,
        createdAt: c.createdAt,
        assignedAgent: c.assignedAgent,
        bestScore,
        daysSinceActivity,
      }
    })

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Clients</h1>
            <p className="text-sm text-muted">{allClients.length} total</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-secondary-soft overflow-hidden text-sm">
              <a
                href="/clients"
                className="px-3 py-1.5 text-muted hover:text-ink hover:bg-canvas transition-colors"
              >
                ☰ List
              </a>
              <a
                href="/clients?view=kanban"
                className="px-3 py-1.5 bg-primary text-white font-medium"
              >
                ⊞ Pipeline
              </a>
            </div>
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
        <KanbanBoard clients={kanbanClients} canWrite={canWrite} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Clients</h1>
          <p className="text-sm text-muted">{total} total</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-secondary-soft overflow-hidden text-sm">
            <a
              href="/clients"
              className="px-3 py-1.5 bg-secondary-soft text-ink font-medium"
            >
              ☰ List
            </a>
            <a
              href="/clients?view=kanban"
              className="px-3 py-1.5 text-muted hover:text-ink hover:bg-canvas transition-colors"
            >
              ⊞ Pipeline
            </a>
          </div>
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
      <div className="flex gap-1 mb-4 border-b border-secondary-soft overflow-x-auto">
        {(["ALL", ...CLIENT_STATUSES] as const).map(s => {
          const params = new URLSearchParams({ ...(q ? { q } : {}), ...(agent ? { agent } : {}), status: s === "ALL" ? "" : s })
          const count = s === "ALL" ? totalAll : (countByStatus[s] ?? 0)
          return (
            <a
              key={s}
              href={`/clients?${params}`}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
                (status ?? "ALL") === s
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_LABELS[s]}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
                  (status ?? "ALL") === s ? "bg-primary/15 text-primary" : "bg-secondary-soft text-muted"
                }`}>
                  {count}
                </span>
              )}
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
            <option key={a.id} value={a.id}>{a.name}</option>
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
          <p className="text-muted text-sm">
            No clients found.{" "}
            {canWrite && <Link href="/clients/new" className="text-primary hover:underline">Add one?</Link>}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-secondary-soft bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary-soft bg-canvas">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Agent</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">TU</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">EXP</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">EQF</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Round</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {clients.map(c => {
                const report = reportMap.get(c.id)
                const dispute = disputeMap.get(c.id)
                const isSent = dispute?.items.some(i => i.sentAt)
                const lastActivity = dispute?.createdAt ?? new Date(c.createdAt)
                // Server component: rendered once per request, so reading the clock here is safe.
                // eslint-disable-next-line react-hooks/purity
                const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

                return (
                  <tr key={c.id} className="hover:bg-canvas transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="block">
                        <p className="font-medium text-ink group-hover:text-primary transition-colors">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-xs text-muted mt-0.5">{c.email ?? c.phone ?? "—"}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {canWrite
                        ? <InlineStatusSelect clientId={c.id} currentStatus={c.status} />
                        : <Link href={`/clients/${c.id}`} className="block"><StatusBadge status={c.status} /></Link>}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <Link href={`/clients/${c.id}`} className="block">
                        {c.assignedAgent?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/clients/${c.id}`} className="block">
                        <ScorePill score={report?.scoreTransunion} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/clients/${c.id}`} className="block">
                        <ScorePill score={report?.scoreExperian} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/clients/${c.id}`} className="block">
                        <ScorePill score={report?.scoreEquifax} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/clients/${c.id}`} className="block">
                        {dispute ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isSent ? "bg-primary/10 text-primary" : "bg-secondary-soft text-muted"
                          }`}>
                            Rd {dispute.round}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      <Link href={`/clients/${c.id}`} className="block">
                        {daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : `${daysSince}d ago`}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted">Page {page} of {totalPages}</p>
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
