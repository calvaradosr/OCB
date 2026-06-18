"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { revalidatePath } from "next/cache"

async function requireDisputes() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "disputes:write")) return null
  return session
}

export async function markLetterSent(letterId: string, trackingInput?: string) {
  const session = await requireDisputes()
  if (!session) return { error: "Unauthorized" }

  const letter = await db.letter.findUnique({ where: { id: letterId } })
  if (!letter) return { error: "Not found" }
  if (letter.sentAt) return { error: "Already marked sent" }

  const isComplaint = letter.target === "CFPB" || letter.target === "FTC"
  await db.letter.update({
    where: { id: letterId },
    data: {
      sentAt: new Date(),
      ...(trackingInput
        ? isComplaint
          ? { complaintNumber: trackingInput }
          : { trackingNumber: trackingInput }
        : {}),
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Letter",
    entityId: letterId,
    detail: { sentAt: new Date().toISOString() },
  })

  revalidatePath("/letters")
  revalidatePath(`/clients/${letter.clientId}`)
  return { ok: true }
}

export async function updateLetterTracking(letterId: string, value: string) {
  const session = await requireDisputes()
  if (!session) return { error: "Unauthorized" }

  const letter = await db.letter.findUnique({ where: { id: letterId } })
  if (!letter) return { error: "Not found" }

  const isComplaint = letter.target === "CFPB" || letter.target === "FTC"
  await db.letter.update({
    where: { id: letterId },
    data: isComplaint ? { complaintNumber: value } : { trackingNumber: value },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Letter",
    entityId: letterId,
    detail: { tracking: value },
  })

  revalidatePath("/letters")
  return { ok: true }
}

export async function markAllLettersSent(): Promise<{ count: number } | { error: string }> {
  const session = await requireDisputes()
  if (!session) return { error: "Unauthorized" }

  const { orgId } = session.user

  const { count } = await db.letter.updateMany({
    where: { sentAt: null, client: { orgId } },
    data: { sentAt: new Date() },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Letter",
    entityId: "bulk",
    detail: { action: "markAllSent", count },
  })

  revalidatePath("/letters")
  return { count }
}
