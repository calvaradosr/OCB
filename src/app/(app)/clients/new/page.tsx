import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import IntakeWizard from "./IntakeWizard"

export default async function NewClientPage() {
  const session = (await auth())!
  if (!can(session.user.role, "clients:write")) redirect("/clients")
  const { orgId } = session.user

  const agents = await db.user.findMany({
    where: { orgId, role: { in: ["AGENT", "MANAGER", "ADMIN"] }, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div>
      <div className="mb-8">
        <a href="/clients" className="text-sm text-muted hover:text-ink transition-colors">
          ← Clients
        </a>
        <h1 className="text-2xl font-semibold text-ink mt-2">New Client</h1>
        <p className="text-sm text-muted mt-1">Complete each step to add a new client to the pipeline.</p>
      </div>

      <IntakeWizard
        agents={agents}
        canAccessPII={can(session.user.role, "clients:read_pii")}
      />
    </div>
  )
}
