"use server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"

export async function addNote(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }

  const clientId = formData.get("clientId") as string
  const rawBody = (formData.get("body") as string)?.trim()
  const noteType = (formData.get("noteType") as string) || "note"

  if (!clientId) return { error: "Missing client ID" }
  if (!rawBody) return { error: "Note body is required" }

  const TYPE_PREFIX: Record<string, string> = {
    call: "[Call] ",
    email: "[Email] ",
    meeting: "[Meeting] ",
    task: "[Task] ",
  }
  const body = (TYPE_PREFIX[noteType] ?? "") + rawBody

  await db.note.create({
    data: { clientId, authorId: session.user.id, body },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Note",
    entityId: clientId,
    detail: { preview: body.slice(0, 80) },
  })

  return {}
}

export async function togglePinNote(noteId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }

  const note = await db.note.findUnique({ where: { id: noteId } })
  if (!note) return { error: "Not found" }

  const pinned = !note.pinned
  await db.note.update({
    where: { id: noteId },
    data: { pinned, pinnedAt: pinned ? new Date() : null },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Note",
    entityId: note.clientId,
    detail: { field: "pinned", value: pinned },
  })

  return {}
}

export async function deleteNote(noteId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const note = await db.note.findUnique({ where: { id: noteId } })
  if (!note) return { error: "Not found" }

  // Only the author or an ADMIN can delete a note
  if (note.authorId !== session.user.id && session.user.role !== "ADMIN") {
    return { error: "Unauthorized" }
  }

  await db.note.delete({ where: { id: noteId } })
  return {}
}
