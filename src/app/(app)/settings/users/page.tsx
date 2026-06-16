import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import InvitePanel from "./InvitePanel"
import { RoleSelect, ToggleActiveButton, ResetPasswordButton } from "./UserActions"
import type { Role } from "@/lib/rbac"

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "users:manage")) redirect("/dashboard")

  const users = await db.user.findMany({
    where: { role: { not: "CLIENT" } },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
  })

  const roleColors: Record<string, string> = {
    ADMIN: "bg-purple-50 text-purple-700",
    MANAGER: "bg-blue-50 text-blue-700",
    AGENT: "bg-green-50 text-success",
    LOAN_PROCESSOR: "bg-yellow-50 text-warning",
    AFFILIATE: "bg-orange-50 text-orange-700",
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Users</h1>
          <p className="text-sm text-muted mt-1">{users.filter(u => u.active).length} active staff</p>
        </div>
      </div>

      {/* Invite panel */}
      <InvitePanel />

      {/* Users table */}
      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary-soft/50">
            <tr>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Name</th>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Email</th>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Role</th>
              <th className="px-5 py-3 text-left text-xs text-muted font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-soft">
            {users.map(u => (
              <tr key={u.id} className={`hover:bg-secondary-soft/20 ${!u.active ? "opacity-50" : ""}`}>
                <td className="px-5 py-3 font-medium text-ink">{u.name}</td>
                <td className="px-5 py-3 text-muted text-xs">{u.email}</td>
                <td className="px-5 py-3">
                  {u.id === session.user.id ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[u.role] ?? "bg-secondary-soft text-muted"}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  ) : (
                    <RoleSelect userId={u.id} current={u.role as Role} />
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium ${u.active ? "text-success" : "text-muted"}`}>
                    {u.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {u.id !== session.user.id && (
                      <ToggleActiveButton userId={u.id} active={u.active} />
                    )}
                    <ResetPasswordButton userId={u.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
