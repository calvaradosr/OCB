"use server"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { encryptPII, decryptPII } from "@/lib/crypto"
import { writeAuditLog } from "@/lib/audit"
import { can } from "@/lib/rbac"
import { isValidStatus, type ClientStatus } from "@/lib/client-utils"
import { runAutomations } from "@/lib/automation"
import { z } from "zod"

const clientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  status: z.string().default("LEAD"),
  assignedAgentId: z.string().optional().or(z.literal("")),
  // PII (plaintext in form, encrypted before save)
  ssn: z.string().optional(),
  dob: z.string().optional(),
})

function parseModules(formData: FormData): string[] {
  const mods: string[] = []
  if (formData.get("mod_cr")) mods.push("CREDIT_REPAIR")
  if (formData.get("mod_loan")) mods.push("LOAN")
  if (formData.get("mod_tradeline")) mods.push("TRADELINE")
  return mods.length ? mods : ["CREDIT_REPAIR"]
}

export async function createClient(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }
  const orgId = session.user.orgId

  const raw = Object.fromEntries(formData.entries())
  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation error" }

  const { ssn, dob, assignedAgentId, ...rest } = parsed.data

  const client = await db.client.create({
    data: {
      ...rest,
      orgId,
      email: rest.email || undefined,
      status: isValidStatus(rest.status) ? rest.status : "LEAD",
      modules: parseModules(formData),
      assignedAgentId: assignedAgentId || undefined,
      ssnEncrypted: ssn ? encryptPII(ssn) : undefined,
      dobEncrypted: dob ? encryptPII(dob) : undefined,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Client",
    entityId: client.id,
    detail: { name: `${client.firstName} ${client.lastName}`, status: client.status },
  })

  // Initial note if provided
  const initialNote = formData.get("note") as string
  if (initialNote?.trim()) {
    await db.note.create({
      data: { clientId: client.id, authorId: session.user.id, body: initialNote.trim() },
    })
  }

  runAutomations({ trigger: "CLIENT_CREATED", clientId: client.id, triggeredBy: client.id }).catch(() => {})

  redirect(`/clients/${client.id}`)
}

export async function updateClient(
  id: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }
  const orgId = session.user.orgId

  const raw = Object.fromEntries(formData.entries())
  const parsed = clientSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation error" }

  const { ssn, dob, assignedAgentId, ...rest } = parsed.data

  const updated = await db.client.update({
    where: { id, orgId },
    data: {
      ...rest,
      email: rest.email || undefined,
      status: isValidStatus(rest.status) ? rest.status : undefined,
      modules: parseModules(formData),
      assignedAgentId: assignedAgentId || null,
      ...(ssn ? { ssnEncrypted: encryptPII(ssn) } : {}),
      ...(dob ? { dobEncrypted: encryptPII(dob) } : {}),
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Client",
    entityId: id,
    detail: { name: `${updated.firstName} ${updated.lastName}` },
  })

  redirect(`/clients/${id}`)
}

export async function updateClientStatus(id: string, status: ClientStatus) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!can(session.user.role, "clients:write")) return { error: "Unauthorized" }
  if (!isValidStatus(status)) return { error: "Invalid status" }

  await db.client.update({ where: { id, orgId: session.user.orgId }, data: { status } })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Client",
    entityId: id,
    detail: { field: "status", value: status },
  })
}

// Decrypts a PII field and writes an audit log. Requires clients:read_pii.
export async function revealPII(
  clientId: string,
  field: "ssn" | "dob"
): Promise<{ value: string } | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "clients:read_pii")) return null

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return null

  const encrypted = field === "ssn" ? client.ssnEncrypted : client.dobEncrypted
  if (!encrypted) return null

  const value = decryptPII(encrypted)

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "Client",
    entityId: clientId,
    detail: { piiField: field },
  })

  return { value }
}
