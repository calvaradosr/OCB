import { getPortalClient } from "@/lib/portal"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import MessageThread from "./MessageThread"

export default async function PortalMessages() {
  const { client, session } = await getPortalClient()

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "PortalMessages",
    entityId: client.id,
  }).catch(() => {})

  const messages = await db.message.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "asc" },
  })

  // Mark unread staff messages as read
  const unreadIds = messages
    .filter(m => m.senderRole !== "CLIENT" && !m.readAt)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Messages</h1>
        <p className="text-muted mt-1">Secure messages with your assigned specialist.</p>
      </div>

      <div className="bg-white rounded-lg border border-secondary-soft overflow-hidden">
        <MessageThread messages={serialized} />
      </div>
    </div>
  )
}
