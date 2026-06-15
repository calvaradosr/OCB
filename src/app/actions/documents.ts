"use server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { can } from "@/lib/rbac"
import { buildS3Key, getPresignedPutUrl } from "@/lib/s3"
import { DOCUMENT_CATEGORIES } from "@/lib/client-utils"

type Category = (typeof DOCUMENT_CATEGORIES)[number]

export async function getUploadUrl(
  clientId: string,
  category: Category,
  fileName: string,
  contentType: string
): Promise<{ presignedUrl: string; s3Key: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }

  // Verify client exists in the org
  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return { error: "Client not found" }

  const s3Key = buildS3Key(client.orgId, clientId, category, fileName)

  try {
    const presignedUrl = await getPresignedPutUrl(s3Key, contentType)
    return { presignedUrl, s3Key }
  } catch {
    return { error: "S3 is not configured. Set S3_DOCUMENTS_BUCKET in environment." }
  }
}

export async function registerDocument(
  clientId: string,
  {
    s3Key,
    fileName,
    category,
    fileSize,
    contentType,
  }: {
    s3Key: string
    fileName: string
    category: string
    fileSize: number
    contentType: string
  }
): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }

  const doc = await db.document.create({
    data: {
      clientId,
      s3Key,
      fileName,
      category,
      fileSize,
      contentType,
      uploadedBy: session.user.id,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Document",
    entityId: doc.id,
    detail: { fileName, category, clientId },
  })

  return { id: doc.id }
}

export async function deleteDocument(documentId: string): Promise<{ error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }

  const doc = await db.document.findUnique({ where: { id: documentId } })
  if (!doc) return { error: "Not found" }

  await db.document.delete({ where: { id: documentId } })

  await writeAuditLog({
    actorId: session.user.id,
    action: "DELETE",
    entity: "Document",
    entityId: documentId,
    detail: { fileName: doc.fileName, clientId: doc.clientId },
  })

  return {}
}
