import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import { ClientForm } from "@/components/ClientForm"
import { createClient } from "@/app/actions/clients"

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
    <div className="max-w-2xl">
      <div className="mb-6">
        <a href="/clients" className="text-sm text-muted hover:text-ink transition-colors">
          ← Clients
        </a>
        <h1 className="text-2xl font-semibold text-ink mt-2">New client</h1>
      </div>

      <ClientForm
        action={createClient}
        agents={agents}
        canAccessPII={can(session.user.role, "clients:read_pii")}
        submitLabel="Create client"
      />
    </div>
  )
}
