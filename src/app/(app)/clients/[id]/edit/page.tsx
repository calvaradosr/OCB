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
    db.client.findUnique({
      where: { id, orgId },
      include: { previousAddresses: { orderBy: { sortOrder: "asc" } } },
    }),
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
          phoneType: client.phoneType ?? "MOBILE",
          altPhone: client.altPhone ?? "",
          altPhoneType: client.altPhoneType ?? "HOME",
          addressLine1: client.addressLine1 ?? "",
          addressLine2: client.addressLine2 ?? "",
          city: client.city ?? "",
          state: client.state ?? "",
          zip: client.zip ?? "",
          previousAddresses: client.previousAddresses.map(a => ({
            addressLine1: a.addressLine1 ?? "",
            addressLine2: a.addressLine2 ?? "",
            city: a.city ?? "",
            state: a.state ?? "",
            zip: a.zip ?? "",
            fromYear: a.fromYear?.toString() ?? "",
            toYear: a.toYear?.toString() ?? "",
          })),
          employerName: client.employerName ?? "",
          occupation: client.occupation ?? "",
          monthlyIncome: client.monthlyIncomeCents != null
            ? (client.monthlyIncomeCents / 100).toString()
            : "",
          leadSource: client.leadSource ?? "",
          tags: client.tags.join(", "),
          coAppFirstName: client.coAppFirstName ?? "",
          coAppLastName: client.coAppLastName ?? "",
          coAppEmail: client.coAppEmail ?? "",
          coAppPhone: client.coAppPhone ?? "",
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
