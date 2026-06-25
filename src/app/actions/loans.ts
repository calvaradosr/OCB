"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { LoanStatus, LoanType } from "@prisma/client"
import {
  canTransition,
  isCreditReady,
  CREDIT_READINESS_THRESHOLD,
  LOAN_DOC_CHECKLIST,
  LOAN_DOC_LABELS,
} from "@/lib/loan-utils"
import { buildS3Key, getPresignedPutUrl } from "@/lib/s3"
import { revalidatePath } from "next/cache"

async function requireLoanWrite() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "loans:write")) return null
  return session
}

// ─── Loan Files ──────────────────────────────────────────────────────────────

export async function createLoanFile(opts: {
  clientId: string
  type: LoanType
  lenderId?: string
  processorId?: string
  amountRequestedCents?: number
  interestRate?: number
  termMonths?: number
  notes?: string
  creditScoreAtConversion?: number
}): Promise<{ id: string } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  const client = await db.client.findUnique({ where: { id: opts.clientId } })
  if (!client) return { error: "Client not found" }

  // Ensure LOAN module is active on client
  if (!client.modules.includes("LOAN")) {
    await db.client.update({
      where: { id: opts.clientId },
      data: { modules: { push: "LOAN" } },
    })
  }

  const loanFile = await db.loanFile.create({
    data: {
      clientId: opts.clientId,
      orgId: client.orgId,
      type: opts.type,
      status: "INTAKE",
      lenderId: opts.lenderId,
      processorId: opts.processorId,
      amountRequestedCents: opts.amountRequestedCents,
      interestRate: opts.interestRate,
      termMonths: opts.termMonths,
      notes: opts.notes,
      creditScoreAtConversion: opts.creditScoreAtConversion,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "LoanFile",
    entityId: loanFile.id,
    detail: { clientId: opts.clientId, type: opts.type },
  })

  revalidatePath("/loans")
  revalidatePath(`/clients/${opts.clientId}`)
  return { id: loanFile.id }
}

export async function updateLoanFile(
  loanFileId: string,
  data: {
    lenderId?: string | null
    processorId?: string | null
    amountRequestedCents?: number | null
    amountApprovedCents?: number | null
    interestRate?: number | null
    termMonths?: number | null
    commissionCents?: number | null
    notes?: string | null
  }
): Promise<{ ok: true } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  await db.loanFile.update({ where: { id: loanFileId }, data })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "LoanFile",
    entityId: loanFileId,
    detail: data,
  })

  revalidatePath(`/loans/${loanFileId}`)
  return { ok: true }
}

export async function updateLoanStatus(
  loanFileId: string,
  newStatus: LoanStatus
): Promise<{ ok: true } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  const file = await db.loanFile.findUnique({ where: { id: loanFileId } })
  if (!file) return { error: "Loan file not found" }

  if (!canTransition(file.status, newStatus)) {
    return { error: `Cannot move from ${file.status} to ${newStatus}` }
  }

  const data: Record<string, unknown> = {
    status: newStatus,
    statusChangedAt: new Date(),
  }
  if (newStatus === "FUNDED") data.fundedAt = new Date()

  await db.loanFile.update({ where: { id: loanFileId }, data })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "LoanFile",
    entityId: loanFileId,
    detail: { from: file.status, to: newStatus },
  })

  // Auto-send doc reminder when entering Docs Collection stage
  if (newStatus === "DOCS_COLLECTION") {
    const full = await db.loanFile.findUnique({
      where: { id: loanFileId },
      include: {
        client: { select: { id: true, portalUserId: true } },
        documents: { select: { category: true } },
      },
    })
    if (full?.client.portalUserId) {
      const required = LOAN_DOC_CHECKLIST[full.type]
      const uploaded = new Set(full.documents.map(d => d.category))
      const missing = required.filter(cat => !uploaded.has(cat))
      if (missing.length > 0) {
        const docList = missing.map(cat => `• ${LOAN_DOC_LABELS[cat] ?? cat}`).join("\n")
        await db.message.create({
          data: {
            clientId: full.client.id,
            senderRole: session.user.role,
            senderId: session.user.id,
            body: `Your loan file is now in the document collection stage. Please upload the following documents through your portal:\n\n${docList}\n\nContact us with any questions.`,
          },
        }).catch(() => {})
      }
    }
  }

  revalidatePath(`/loans/${loanFileId}`)
  revalidatePath("/loans")
  return { ok: true }
}

// ─── Conditions ───────────────────────────────────────────────────────────────

export async function addCondition(
  loanFileId: string,
  description: string
): Promise<{ id: string } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  const condition = await db.loanCondition.create({
    data: { loanFileId, description },
  })

  revalidatePath(`/loans/${loanFileId}`)
  return { id: condition.id }
}

export async function updateConditionStatus(
  conditionId: string,
  status: "CLEARED" | "WAIVED" | "OPEN"
): Promise<{ ok: true } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  const condition = await db.loanCondition.findUnique({ where: { id: conditionId } })
  if (!condition) return { error: "Condition not found" }

  await db.loanCondition.update({
    where: { id: conditionId },
    data: {
      status,
      clearedAt: status !== "OPEN" ? new Date() : null,
      clearedById: status !== "OPEN" ? session.user.id : null,
    },
  })

  revalidatePath(`/loans/${condition.loanFileId}`)
  return { ok: true }
}

// ─── Loan Documents ───────────────────────────────────────────────────────────

export async function getLoanUploadUrl(
  loanFileId: string,
  category: string,
  fileName: string,
  contentType: string
): Promise<{ presignedUrl: string; s3Key: string } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  const file = await db.loanFile.findUnique({
    where: { id: loanFileId },
    include: { client: true },
  })
  if (!file) return { error: "Loan file not found" }

  const s3Key = buildS3Key(file.client.orgId, file.clientId, `loan/${loanFileId}/${category}`, fileName)

  try {
    const presignedUrl = await getPresignedPutUrl(s3Key, contentType)
    return { presignedUrl, s3Key }
  } catch {
    return { error: "S3 is not configured." }
  }
}

export async function registerLoanDocument(opts: {
  loanFileId: string
  category: string
  s3Key: string
  fileName: string
  fileSize: number
  contentType: string
}): Promise<{ id: string } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  const doc = await db.loanDocument.create({
    data: {
      loanFileId: opts.loanFileId,
      category: opts.category,
      s3Key: opts.s3Key,
      fileName: opts.fileName,
      fileSize: opts.fileSize,
      contentType: opts.contentType,
      uploadedBy: session.user.id,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "LoanDocument",
    entityId: doc.id,
    detail: { loanFileId: opts.loanFileId, category: opts.category },
  })

  revalidatePath(`/loans/${opts.loanFileId}`)
  return { id: doc.id }
}

// ─── Lenders ─────────────────────────────────────────────────────────────────

export async function createLender(opts: {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  programs?: string[]
  minCreditScore?: number
  submissionNotes?: string
}): Promise<{ id: string } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  const lender = await db.lender.create({ data: { ...opts, orgId: session.user.orgId } })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Lender",
    entityId: lender.id,
    detail: { name: opts.name },
  })

  revalidatePath("/lenders")
  return { id: lender.id }
}

// ─── Credit-readiness bridge ─────────────────────────────────────────────────
// Called after every report import. If the client just crossed the score
// threshold and has no existing loan files, auto-creates an INTAKE loan file.
export async function autoCreateLoanLead(
  clientId: string,
  scores: { experian: number | null; equifax: number | null; transunion: number | null }
): Promise<void> {
  if (!isCreditReady(scores)) return

  const existing = await db.loanFile.count({ where: { clientId } })
  if (existing > 0) return

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { orgId: true, modules: true },
  })
  if (!client) return

  const minScore = Math.min(
    ...[scores.experian, scores.equifax, scores.transunion].filter((s): s is number => s != null)
  )

  await db.loanFile.create({
    data: {
      clientId,
      orgId: client.orgId,
      type: "PERSONAL",
      status: "INTAKE",
      creditScoreAtConversion: minScore,
      notes: `Auto-created by credit-readiness bridge — all bureau scores reached ${CREDIT_READINESS_THRESHOLD}+. Review and update loan type before advancing.`,
    },
  })

  if (!client.modules.includes("LOAN")) {
    await db.client.update({
      where: { id: clientId },
      data: { modules: { push: "LOAN" } },
    })
  }

  revalidatePath("/loans")
  revalidatePath(`/clients/${clientId}`)
}

export async function updateLender(
  lenderId: string,
  opts: {
    name?: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    programs?: string[]
    minCreditScore?: number | null
    submissionNotes?: string | null
    active?: boolean
  }
): Promise<{ ok: true } | { error: string }> {
  const session = await requireLoanWrite()
  if (!session) return { error: "Unauthorized" }

  await db.lender.update({ where: { id: lenderId }, data: opts })

  revalidatePath("/lenders")
  revalidatePath(`/lenders/${lenderId}`)
  return { ok: true }
}
