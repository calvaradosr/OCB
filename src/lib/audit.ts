// GLBA audit log writer — call on every PII view, create, update, delete.
// Brief §4.9: "full audit log: who viewed/edited what, when."
import { db } from "./db"
import type { Prisma } from "@prisma/client"

export type AuditAction =
  | "VIEW" | "VIEW_PII" | "CREATE" | "UPDATE" | "DELETE"
  | "EXPORT" | "LOGIN" | "LOGOUT" | "BULK_MARK_PAID"

export interface AuditParams {
  actorId?: string | null
  orgId?: string
  action: AuditAction
  entity: string
  entityId?: string
  detail?: Prisma.InputJsonValue
  ip?: string | null
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await db.auditLog.create({
    data: {
      orgId: params.orgId ?? "ocb",
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      detail: params.detail ?? undefined,
      ip: params.ip ?? null,
    },
  })
}
