"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import {
  renderClientAgreement,
  renderCancellationNotice,
  renderPOA,
  type AgreementMergeFields,
} from "@/lib/agreements"
import { AgreementType } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function sendAgreement(
  clientId: string,
  type: AgreementType,
  fields: AgreementMergeFields
): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return { error: "Client not found" }

  let body: string
  if (type === "CLIENT_AGREEMENT") {
    body = renderClientAgreement(fields)
  } else if (type === "CANCELLATION_NOTICE") {
    body = renderCancellationNotice(fields)
  } else if (type === "POWER_OF_ATTORNEY") {
    body = renderPOA(fields)
  } else {
    body = fields.clientName // fallback for OTHER
  }

  const agreement = await db.agreement.create({
    data: { clientId, type, body, status: "PENDING" },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Agreement",
    entityId: agreement.id,
    detail: { type, clientId },
  })

  revalidatePath(`/clients/${clientId}/agreements`)
  return { id: agreement.id }
}
