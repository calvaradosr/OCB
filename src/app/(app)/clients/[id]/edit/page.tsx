import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { ClientForm } from "@/components/ClientForm"
import { updateClient } from "@/app/actions/clients"

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = (await auth())!
  if (!can(session.user.role, "clients:write")) redirect("/clients")
  const { orgId } = session.user

  const { id } = await params

  const [client, agents] = await Promise.all([
    db.client.findUnique({ where: { id, orgId } }),
    db.user.findMany({
      where: { orgId, role: { in: ["AGENT", "MANAGER", "ADMIN"] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!client) notFound()

  const boundAction = updateClient.bind(null, id)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/clients/${id}`} className="text-sm text-muted hover:text-ink transition-colors">
          ← {client.firstName} {client.lastName}
        </Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">Edit client</h1>
      </div>

      <ClientForm
        action={boundAction}
        defaultValues={{
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email ?? "",
          phone: client.phone ?? "",
          addressLine1: client.addressLine1 ?? "",
          addressLine2: client.addressLine2 ?? "",
          city: client.city ?? "",
          state: client.state ?? "",
          zip: client.zip ?? "",
          status: client.status,
          assignedAgentId: client.assignedAgentId ?? "",
          modules: client.modules,
        }}
        agents={agents}
        canAccessPII={can(session.user.role, "clients:read_pii")}
        submitLabel="Save changes"
      />
    </div>
  )
}
