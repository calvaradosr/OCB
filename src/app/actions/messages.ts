"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { revalidatePath } from "next/cache"

export async function staffSendMessage(
  clientId: string,
  body: string
): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }
  if (!body.trim()) return { error: "Message is empty" }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return { error: "Client not found" }

  const msg = await db.message.create({
    data: {
      clientId,
      senderRole: session.user.role,
      senderId: session.user.id,
      body: body.trim(),
    },
  })

  revalidatePath(`/clients/${clientId}/messages`)
  return { id: msg.id }
}
