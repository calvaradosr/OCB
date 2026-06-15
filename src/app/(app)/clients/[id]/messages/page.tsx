import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import StaffMessageThread from "./StaffMessageThread"

export default async function ClientMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "clients:read")) redirect("/dashboard")

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) redirect("/clients")

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "ClientMessages",
    entityId: clientId,
  }).catch(() => {})

  const messages = await db.message.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
  })

  // Mark unread client messages as read when staff views
  const unreadIds = messages
    .filter(m => m.senderRole === "CLIENT" && !m.readAt)
    .map(m => m.id)

  if (unreadIds.length > 0) {
    await db.message.updateMany({
      where: { id: { in: unreadIds } },
      data: { readAt: new Date() },
    })
  }

  const serialized = messages.map(m => ({
    id: m.id,
    senderRole: m.senderRole,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">
        Messages — {client.firstName} {client.lastName}
      </h2>

      <div className="bg-white rounded-lg border border-secondary-soft overflow-hidden">
        <StaffMessageThread messages={serialized} clientId={clientId} />
      </div>
    </div>
  )
}
