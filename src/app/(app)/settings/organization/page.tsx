import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import OrgSettingsForm from "./OrgSettingsForm"
import NewOrgForm from "./NewOrgForm"

export default async function OrganizationSettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "settings:write")) redirect("/settings")

  const { orgId } = session.user

  const org = await db.organization.findUnique({ where: { slug: orgId } })
  const users = await db.user.findMany({
    where: { orgId },
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: { name: "asc" },
  })

  const allOrgs = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    select: { slug: true, name: true, plan: true, active: true, createdAt: true },
  })

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href="/settings" className="text-sm text-muted hover:text-ink transition-colors">← Settings</Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">Organization</h1>
      </div>

      {/* Current org info */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">{org?.name ?? orgId}</h2>
            <p className="text-xs text-muted mt-0.5">
              Slug: <span className="font-mono">{orgId}</span>
              {" · "}Plan: <span className="capitalize">{org?.plan ?? "standard"}</span>
            </p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${org?.active ? "bg-green-50 text-success" : "bg-secondary-soft text-muted"}`}>
            {org?.active ? "Active" : "Inactive"}
          </span>
        </div>

        <OrgSettingsForm currentName={org?.name ?? orgId} />

        <div className="pt-4 border-t border-secondary-soft">
          <p className="text-xs text-muted font-semibold uppercase tracking-widest mb-3">Staff ({users.length})</p>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-ink font-medium">{u.name}</span>
                  <span className="text-muted ml-2">{u.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{u.role}</span>
                  {!u.active && <span className="text-xs text-warning">(inactive)</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All organizations (super-admin view) */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink">All Organizations</h2>
        <div className="space-y-2">
          {allOrgs.map(o => (
            <div key={o.slug} className="flex items-center justify-between text-sm">
              <div>
                <span className={`font-medium ${o.slug === orgId ? "text-primary" : "text-ink"}`}>
                  {o.name}
                  {o.slug === orgId && " (you)"}
                </span>
                <span className="text-xs text-muted ml-2 font-mono">{o.slug}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="capitalize">{o.plan}</span>
                <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                <span className={o.active ? "text-success" : "text-muted"}>
                  {o.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create new org */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
        <h2 className="text-sm font-semibold text-ink">Create New Organization</h2>
        <p className="text-xs text-muted">Creates a new isolated tenant with its own admin account.</p>
        <NewOrgForm />
      </div>
    </div>
  )
}
