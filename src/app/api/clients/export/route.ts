// CSV export — no PII (SSN/DOB excluded). Auth check required.
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { buildCSV } from "@/lib/client-utils"
import { writeAuditLog } from "@/lib/audit"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  if (!can(session.user.role, "clients:read")) return new Response("Forbidden", { status: 403 })

  const clients = await db.client.findMany({
    where: { orgId: "ocb" },
    include: { assignedAgent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const rows = clients.map(c => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email ?? "",
    phone: c.phone ?? "",
    status: c.status,
    modules: c.modules.join("|"),
    assignedAgent: c.assignedAgent?.name ?? "",
    addressLine1: c.addressLine1 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    zip: c.zip ?? "",
    createdAt: c.createdAt.toISOString(),
  }))

  const csv = buildCSV(rows)

  await writeAuditLog({
    actorId: session.user.id,
    action: "EXPORT",
    entity: "Client",
    detail: { count: rows.length },
  })

  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="ocb-clients-${date}.csv"`,
    },
  })
}
