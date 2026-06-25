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

  // CROA §1679b(b): every credit repair client must receive a written contract
  // We auto-create the agreement in PENDING status; client signs via portal at /portal/sign/:id
  const agreementBody = `CREDIT REPAIR SERVICES AGREEMENT

This agreement is entered into between One Consulting Business ("Company") and ${client.firstName} ${client.lastName} ("Client").

SERVICES: The Company agrees to perform the following services on behalf of Client: reviewing Client's credit reports, identifying inaccurate, erroneous, or unverifiable information, and preparing written correspondence to credit bureaus and data furnishers disputing such information.

FEES: Client shall be charged only AFTER services are performed. No advance fees are charged. All fees will be disclosed on a separate fee schedule. Fees are charged on a per-deletion basis or as agreed in writing.

RIGHT TO CANCEL: You have the right to cancel this contract, for any reason, within 3 business days from the date you signed it. If you cancel, any payment you made must be returned to you within 10 days following receipt of your cancellation notice.

CONSUMER RIGHTS: You have a right to dispute inaccurate information in your credit report by contacting the credit bureau directly, free of charge. You have a right to obtain a free copy of your credit report from each credit bureau annually at AnnualCreditReport.com.

IMPORTANT NOTICE REQUIRED BY FEDERAL LAW: You have a right to sue a credit repair organization that violates the Credit Repair Organizations Act. This law prohibits deceptive practices by credit repair organizations. Do not sign this contract before you read it. The Company cannot promise to permanently remove truthful information from your credit report.

Client Signature: ___________________________  Date: _______________

Company Representative: ___________________________  Date: _______________`

  await db.agreement.create({
    data: {
      clientId: client.id,
      type: "CLIENT_AGREEMENT",
      status: "PENDING",
      body: agreementBody,
    },
  })

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
