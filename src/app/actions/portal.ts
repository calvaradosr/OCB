"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { buildS3Key, getPresignedPutUrl } from "@/lib/s3"
import { DOCUMENT_CATEGORIES } from "@/lib/client-utils"
import { revalidatePath } from "next/cache"

type Category = (typeof DOCUMENT_CATEGORIES)[number]

// Resolve the Client record for the currently authenticated CLIENT-role user.
async function resolvePortalClient() {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") return null
  return db.client.findFirst({ where: { portalUserId: session.user.id } })
}

// --- Documents ---

export async function portalGetUploadUrl(
  category: Category,
  fileName: string,
  contentType: string
): Promise<{ presignedUrl: string; s3Key: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") return { error: "Unauthorized" }

  const client = await resolvePortalClient()
  if (!client) return { error: "Client record not found" }

  const s3Key = buildS3Key(client.orgId, client.id, category, fileName)

  try {
    const presignedUrl = await getPresignedPutUrl(s3Key, contentType)
    return { presignedUrl, s3Key }
  } catch {
    return { error: "S3 is not configured." }
  }
}

export async function portalRegisterDocument(opts: {
  s3Key: string
  fileName: string
  category: string
  fileSize: number
  contentType: string
}): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") return { error: "Unauthorized" }

  const client = await resolvePortalClient()
  if (!client) return { error: "Client record not found" }

  const doc = await db.document.create({
    data: {
      clientId: client.id,
      s3Key: opts.s3Key,
      fileName: opts.fileName,
      category: opts.category,
      fileSize: opts.fileSize,
      contentType: opts.contentType,
      uploadedBy: session.user.id,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Document",
    entityId: doc.id,
    detail: { fileName: opts.fileName, category: opts.category, clientId: client.id },
  })

  revalidatePath("/portal/documents")
  return { id: doc.id }
}

// --- Messages ---

export async function portalSendMessage(body: string): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") return { error: "Unauthorized" }
  if (!body.trim()) return { error: "Message is empty" }

  const client = await resolvePortalClient()
  if (!client) return { error: "Client record not found" }

  const msg = await db.message.create({
    data: {
      clientId: client.id,
      senderRole: "CLIENT",
      senderId: session.user.id,
      body: body.trim(),
    },
  })

  revalidatePath("/portal/messages")
  return { id: msg.id }
}

// --- Loan Documents (portal upload) ---

export async function portalGetLoanUploadUrl(
  loanFileId: string,
  category: string,
  fileName: string,
  contentType: string
): Promise<{ presignedUrl: string; s3Key: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") return { error: "Unauthorized" }

  const client = await resolvePortalClient()
  if (!client) return { error: "Client record not found" }

  const loanFile = await db.loanFile.findFirst({
    where: { id: loanFileId, clientId: client.id },
  })
  if (!loanFile) return { error: "Loan file not found" }

  const s3Key = buildS3Key(client.orgId, client.id, `loan/${loanFileId}/${category}`, fileName)

  try {
    const presignedUrl = await getPresignedPutUrl(s3Key, contentType)
    return { presignedUrl, s3Key }
  } catch {
    return { error: "S3 is not configured." }
  }
}

export async function portalRegisterLoanDocument(opts: {
  loanFileId: string
  category: string
  s3Key: string
  fileName: string
  fileSize: number
  contentType: string
}): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") return { error: "Unauthorized" }

  const client = await resolvePortalClient()
  if (!client) return { error: "Client record not found" }

  const loanFile = await db.loanFile.findFirst({
    where: { id: opts.loanFileId, clientId: client.id },
  })
  if (!loanFile) return { error: "Loan file not found" }

  const doc = await db.loanDocument.create({
    data: {
      loanFileId: opts.loanFileId,
      category: opts.category,
      s3Key: opts.s3Key,
      fileName: opts.fileName,
      fileSize: opts.fileSize,
      contentType: opts.contentType,
      uploadedBy: "CLIENT",
    },
  })

  revalidatePath("/portal/loans")
  return { id: doc.id }
}

// --- E-sign ---

export async function portalSignAgreement(
  agreementId: string,
  signatureDataUrl: string
): Promise<{ ok: true } | { error: string }> {
  const session = await auth()
  if (!session || session.user.role !== "CLIENT") return { error: "Unauthorized" }

  const client = await resolvePortalClient()
  if (!client) return { error: "Client record not found" }

  const agreement = await db.agreement.findUnique({ where: { id: agreementId } })
  if (!agreement || agreement.clientId !== client.id) return { error: "Not found" }
  if (agreement.status !== "PENDING") return { error: "Already signed" }

  const signedAt = new Date()

  await db.agreement.update({
    where: { id: agreementId },
    data: {
      status: "SIGNED",
      signatureDataUrl,
      signedAt,
      // CROA: 3-business-day cancellation window (add 5 calendar days to be safe across weekends)
      expiresAt:
        agreement.type === "CLIENT_AGREEMENT" || agreement.type === "CANCELLATION_NOTICE"
          ? new Date(signedAt.getTime() + 5 * 24 * 60 * 60 * 1000)
          : null,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Agreement",
    entityId: agreementId,
    detail: { action: "signed", type: agreement.type },
  })

  revalidatePath("/portal/dashboard")
  revalidatePath(`/portal/sign/${agreementId}`)
  return { ok: true }
}
