"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { generateBureauLetters, SelectedItem } from "@/lib/letters/generate"
import { calculateDueDate } from "@/lib/fcra"
import { runAutomations } from "@/lib/automation"
import fs from "fs/promises"
import path from "path"

const TEMPLATES_DIR = path.join(process.cwd(), "src/lib/letters/templates")

async function readTemplate(name: string, orgId?: string): Promise<string> {
  // Check for org-specific override in DB first
  if (orgId) {
    const override = await db.letterTemplate.findFirst({
      where: { name: `${orgId}:${name}`, active: true },
      select: { body: true },
    })
    if (override) return override.body
  }
  return fs.readFile(path.join(TEMPLATES_DIR, `${name}.md`), "utf8")
}

export type DisputeSelection = {
  itemId: string
  creditorName: string
  accountNumberMasked: string | null
  type: string
  bureaus: string[]
  reason: string
}

export type DisputeWizardData = {
  clientId: string
  strategy: string
  templateId: string
  includeCFPB: boolean
  includeFTC: boolean
  includeStateAG: boolean
  selections: DisputeSelection[]
}

function buildMergeClient(client: {
  firstName: string; lastName: string
  addressLine1: string | null; city: string | null; state: string | null; zip: string | null
}) {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    addressLine1: client.addressLine1 ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    zip: client.zip ?? "",
  }
}

export async function previewDisputeLetters(data: DisputeWizardData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  if (!can(session.user.role, "disputes:write")) throw new Error("Forbidden")

  const client = await db.client.findUniqueOrThrow({
    where: { id: data.clientId },
    select: { firstName: true, lastName: true, addressLine1: true, city: true, state: true, zip: true },
  })

  const orgId = session.user.orgId
  const template = await readTemplate(data.templateId, orgId)
  const cfpbTemplate = data.includeCFPB ? await readTemplate("cfpb-complaint", orgId) : undefined
  const ftcTemplate = data.includeFTC ? await readTemplate("ftc-identity-theft", orgId) : undefined
  const stateAgTemplate = data.includeStateAG ? await readTemplate("state-ag-complaint", orgId) : undefined

  const items: SelectedItem[] = data.selections.map(s => ({
    creditorName: s.creditorName,
    accountNumberMasked: s.accountNumberMasked,
    type: s.type,
    reason: s.reason,
    bureaus: s.bureaus as never,
  }))

  return generateBureauLetters(template, buildMergeClient(client), items, {
    includeCFPB: data.includeCFPB,
    includeFTC: data.includeFTC,
    includeStateAG: data.includeStateAG,
    cfpbTemplate,
    ftcTemplate,
    stateAgTemplate,
  })
}

export async function createDispute(
  data: DisputeWizardData
): Promise<{ disputeId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }
  if (!can(session.user.role, "disputes:write")) return { error: "Forbidden" }
  if (!data.selections.length) return { error: "Select at least one item to dispute." }

  const client = await db.client.findUniqueOrThrow({
    where: { id: data.clientId },
    select: { firstName: true, lastName: true, addressLine1: true, city: true, state: true, zip: true },
  })

  const existingCount = await db.dispute.count({ where: { clientId: data.clientId } })
  const orgId = session.user.orgId

  const template = await readTemplate(data.templateId, orgId)
  const cfpbTemplate = data.includeCFPB ? await readTemplate("cfpb-complaint", orgId) : undefined
  const ftcTemplate = data.includeFTC ? await readTemplate("ftc-identity-theft", orgId) : undefined
  const stateAgTemplate = data.includeStateAG ? await readTemplate("state-ag-complaint", orgId) : undefined

  const items: SelectedItem[] = data.selections.map(s => ({
    creditorName: s.creditorName,
    accountNumberMasked: s.accountNumberMasked,
    type: s.type,
    reason: s.reason,
    bureaus: s.bureaus as never,
  }))

  const generatedLetters = generateBureauLetters(template, buildMergeClient(client), items, {
    includeCFPB: data.includeCFPB,
    includeFTC: data.includeFTC,
    includeStateAG: data.includeStateAG,
    cfpbTemplate,
    ftcTemplate,
    stateAgTemplate,
  })

  const dispute = await db.$transaction(async tx => {
    const d = await tx.dispute.create({
      data: {
        clientId: data.clientId,
        round: existingCount + 1,
        strategy: data.strategy,
      },
    })

    for (const sel of data.selections) {
      for (const bureau of sel.bureaus) {
        await tx.disputeItem.create({
          data: {
            disputeId: d.id,
            itemId: sel.itemId,
            bureau: bureau as never,
            outcome: "PENDING",
          },
        })
      }
    }

    for (const gl of generatedLetters) {
      await tx.letter.create({
        data: {
          clientId: data.clientId,
          disputeId: d.id,
          target: gl.target as never,
          bureau: (gl.bureau ?? null) as never,
          templateId: data.templateId,
          renderedBody: gl.body,
        },
      })
    }

    return d
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Dispute",
    entityId: dispute.id,
    detail: {
      round: dispute.round,
      strategy: data.strategy,
      itemCount: data.selections.length,
      letterCount: generatedLetters.length,
    },
  })

  return { disputeId: dispute.id }
}

export async function markDisputeSent(disputeId: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  if (!can(session.user.role, "disputes:write")) throw new Error("Forbidden")

  const now = new Date()
  const dueAt = calculateDueDate(now)

  await db.$transaction([
    db.disputeItem.updateMany({
      where: { disputeId, sentAt: null },
      data: { sentAt: now, dueAt },
    }),
    db.letter.updateMany({
      where: { disputeId, sentAt: null },
      data: { sentAt: now },
    }),
  ])

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Dispute",
    entityId: disputeId,
    detail: { action: "marked_sent", dueAt: dueAt.toISOString() },
  })
}

export async function recordOutcome(
  disputeItemId: string,
  outcome: "DELETED" | "REPAIRED" | "VERIFIED" | "NO_RESPONSE"
): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  if (!can(session.user.role, "disputes:write")) throw new Error("Forbidden")

  const item = await db.disputeItem.update({
    where: { id: disputeItemId },
    data: { outcome, resolvedAt: new Date() },
    include: { dispute: { select: { clientId: true } } },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "DisputeItem",
    entityId: disputeItemId,
    detail: { outcome },
  })

  const clientId = item.dispute.clientId
  runAutomations({ trigger: "DISPUTE_OUTCOME_ANY", clientId, triggeredBy: disputeItemId }).catch(() => {})
  if (outcome === "DELETED") {
    runAutomations({ trigger: "DISPUTE_OUTCOME_DELETED", clientId, triggeredBy: disputeItemId }).catch(() => {})
  }
}
