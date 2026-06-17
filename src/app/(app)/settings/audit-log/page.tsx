import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-50 text-success",
  UPDATE: "bg-blue-50 text-blue-700",
  DELETE: "bg-red-50 text-danger",
  VIEW: "bg-secondary-soft text-muted",
  EXPORT: "bg-yellow-50 text-warning",
  LOGIN: "bg-purple-50 text-purple-700",
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; actor?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "settings:write")) redirect("/dashboard")
  const { orgId } = session.user

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10))
  const pageSize = 50
  const skip = (page - 1) * pageSize

  const where = {
    orgId,
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.actor ? { actorId: sp.actor } : {}),
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  const entities = await db.auditLog.findMany({
    where: { orgId },
    distinct: ["entity"],
    select: { entity: true },
    orderBy: { entity: "asc" },
  })

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Audit Log</h1>
        <p className="text-sm text-muted mt-1">{total.toLocaleString()} total entries · GLBA-required access trail</p>
      </div>

      {/* Filters */}
      <form className="flex gap-3">
        <select
          name="entity"
          defaultValue={sp.entity ?? ""}
          className="rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All entities</option>
          {entities.map(e => (
            <option key={e.entity} value={e.entity}>{e.entity}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
          Filter
        </button>
        {(sp.entity || sp.actor) && (
          <a href="/settings/audit-log" className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">
            Clear
          </a>
        )}
      </form>

      {/* Log table */}
      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary-soft/50">
            <tr>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Time</th>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Actor</th>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Action</th>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Entity</th>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-soft">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-secondary-soft/20">
                <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-5 py-3 text-xs">
                  {log.actor ? (
                    <span className="text-ink">{log.actor.name}</span>
                  ) : (
                    <span className="text-muted italic">system</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? "bg-secondary-soft text-muted"}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-muted">
                  {log.entity}
                  {log.entityId && <span className="ml-1 font-mono opacity-60">{log.entityId.slice(-6)}</span>}
                </td>
                <td className="px-5 py-3 text-xs text-muted max-w-xs truncate">
                  {log.detail ? JSON.stringify(log.detail) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?page=${page - 1}${sp.entity ? `&entity=${sp.entity}` : ""}`} className="px-3 py-1.5 rounded-lg border border-secondary-soft hover:text-ink transition-colors">
                ← Prev
              </a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}${sp.entity ? `&entity=${sp.entity}` : ""}`} className="px-3 py-1.5 rounded-lg border border-secondary-soft hover:text-ink transition-colors">
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
