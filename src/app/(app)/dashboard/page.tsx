import { auth } from "@/auth"

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink mb-1">Dashboard</h1>
      <p className="text-muted mb-8">Welcome back, {user.name}.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Role" value={user.role.replace("_", " ")} />
        <StatCard label="MFA" value={user.mfaEnabled ? "Enabled ✓" : "Not set up"} />
        <StatCard label="Platform" value="OCB v0.1 — M0" />
      </div>

      <div className="mt-10 rounded-xl border border-secondary-soft bg-white p-6 text-sm text-muted">
        <strong className="text-ink">Milestone M0 complete.</strong> Auth, RBAC, audit log, and
        CI/CD are in place. M1 (CRM — leads, clients, documents) is next.
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-secondary-soft bg-white p-5">
      <p className="text-xs uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}
