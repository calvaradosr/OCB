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
  phoneType: z.string().optional(),
  altPhone: z.string().optional(),
  altPhoneType: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  employerName: z.string().optional(),
  occupation: z.string().optional(),
  leadSource: z.string().optional(),
  status: z.string().default("LEAD"),
  assignedAgentId: z.string().optional().or(z.literal("")),
  // PII (plaintext in form, encrypted before save)
  ssn: z.string().optional(),
  dob: z.string().optional(),
  // Co-applicant / spouse
  coAppFirstName: z.string().optional(),
  coAppLastName: z.string().optional(),
  coAppEmail: z.string().email().optional().or(z.literal("")),
  coAppPhone: z.string().optional(),
  coAppSsn: z.string().optional(),
  coAppDob: z.string().optional(),
  // Special-handled (parsed, not spread directly): dollars → cents
  monthlyIncome: z.string().optional(),
})

function parseModules(formData: FormData): string[] {
  const mods: string[] = []
  if (formData.get("mod_cr")) mods.push("CREDIT_REPAIR")
  if (formData.get("mod_loan")) mods.push("LOAN")
  if (formData.get("mod_tradeline")) mods.push("TRADELINE")
  return mods.length ? mods : ["CREDIT_REPAIR"]
}

function parseTags(formData: FormData): string[] {
  const raw = (formData.get("tags") as string) ?? ""
  return raw.split(",").map(t => t.trim()).filter(Boolean).slice(0, 20)
}

type PrevAddrInput = {
  addressLine1?: string; addressLine2?: string; city?: string
  state?: string; zip?: string; fromYear?: string | number; toYear?: string | number
}

// Previous addresses arrive as a JSON string from the client form. Returns
// Prisma nested-create rows (sortOrder preserves input order). Blank rows drop.
function parsePreviousAddresses(formData: FormData) {
  const raw = (formData.get("previousAddresses") as string) ?? ""
  if (!raw.trim()) return []
  let rows: PrevAddrInput[] = []
  try { rows = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(rows)) return []
  const year = (v: unknown) => {
    const n = parseInt(String(v ?? ""), 10)
    return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : null
  }
  return rows
    .filter(r => r && (r.addressLine1 || r.city || r.state || r.zip))
    .slice(0, 10)
    .map((r, i) => ({
      addressLine1: r.addressLine1 || null,
      addressLine2: r.addressLine2 || null,
      city: r.city || null,
      state: r.state || null,
      zip: r.zip || null,
      fromYear: year(r.fromYear),
      toYear: year(r.toYear),
      sortOrder: i,
    }))
}

// Dollars (string) → integer cents, or undefined when blank/invalid.
function dollarsToCents(v: string | undefined): number | undefined {
  if (!v?.trim()) return undefined
  const n = parseFloat(v.replace(/[^0-9.]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) : undefined
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

  const { ssn, dob, assignedAgentId, monthlyIncome, coAppSsn, coAppDob, coAppEmail, ...rest } = parsed.data
  const prevAddresses = parsePreviousAddresses(formData)

  const client = await db.client.create({
    data: {
      ...rest,
      orgId,
      email: rest.email || undefined,
      status: isValidStatus(rest.status) ? rest.status : "LEAD",
      modules: parseModules(formData),
      tags: parseTags(formData),
      assignedAgentId: assignedAgentId || undefined,
      monthlyIncomeCents: dollarsToCents(monthlyIncome),
      ssnEncrypted: ssn ? encryptPII(ssn) : undefined,
      dobEncrypted: dob ? encryptPII(dob) : undefined,
      coAppEmail: coAppEmail || undefined,
      coAppSsnEncrypted: coAppSsn ? encryptPII(coAppSsn) : undefined,
      coAppDobEncrypted: coAppDob ? encryptPII(coAppDob) : undefined,
      previousAddresses: prevAddresses.length ? { create: prevAddresses } : undefined,
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

  const { ssn, dob, assignedAgentId, monthlyIncome, coAppSsn, coAppDob, coAppEmail, ...rest } = parsed.data

  const clientData = {
    ...rest,
    email: rest.email || undefined,
    status: isValidStatus(rest.status) ? rest.status : undefined,
    modules: parseModules(formData),
    tags: parseTags(formData),
    assignedAgentId: assignedAgentId || null,
    monthlyIncomeCents: dollarsToCents(monthlyIncome) ?? null,
    coAppEmail: coAppEmail || null,
    ...(ssn ? { ssnEncrypted: encryptPII(ssn) } : {}),
    ...(dob ? { dobEncrypted: encryptPII(dob) } : {}),
    ...(coAppSsn ? { coAppSsnEncrypted: encryptPII(coAppSsn) } : {}),
    ...(coAppDob ? { coAppDobEncrypted: encryptPII(coAppDob) } : {}),
  }

  // Only touch the previous-address list when the form actually submitted it.
  // The destructive deleteMany must NOT run for callers that don't manage
  // addresses (e.g. a partial form) — otherwise saving would wipe the history.
  const updated = formData.has("previousAddresses")
    ? await db.$transaction(async tx => {
        // Edited as a whole list — replace atomically so removed rows drop and
        // order is preserved.
        await tx.clientAddress.deleteMany({ where: { clientId: id } })
        const prevAddresses = parsePreviousAddresses(formData)
        return tx.client.update({
          where: { id, orgId },
          data: {
            ...clientData,
            previousAddresses: prevAddresses.length ? { create: prevAddresses } : undefined,
          },
        })
      })
    : await db.client.update({ where: { id, orgId }, data: clientData })

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
  field: "ssn" | "dob" | "coAppSsn" | "coAppDob"
): Promise<{ value: string } | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "clients:read_pii")) return null

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return null

  const encrypted =
    field === "ssn" ? client.ssnEncrypted :
    field === "dob" ? client.dobEncrypted :
    field === "coAppSsn" ? client.coAppSsnEncrypted :
    client.coAppDobEncrypted
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
