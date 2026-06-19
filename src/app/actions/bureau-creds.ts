"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { encryptPII, decryptPII } from "@/lib/crypto"
import { writeAuditLog } from "@/lib/audit"
import type { BureauService } from "@prisma/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export type BureauCredentialPublic = {
  id: string
  service: BureauService
  username: string
  lastFetchAt: Date | null
  lastStatus: string | null
  lastError: string | null
}

// ─── saveBureauCredential ─────────────────────────────────────────────────────

export async function saveBureauCredential(
  clientId: string,
  service: BureauService,
  username: string,
  password: string
): Promise<{ ok: true } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }
  if (!can(session.user.role, "clients:write")) return { error: "Forbidden" }

  if (!username.trim()) return { error: "Username is required" }
  if (!password.trim()) return { error: "Password is required" }

  // Verify client belongs to this org
  const client = await db.client.findUnique({
    where: { id: clientId, orgId: session.user.orgId },
    select: { id: true },
  })
  if (!client) return { error: "Client not found" }

  const passwordEncrypted = encryptPII(password)

  await db.bureauCredential.upsert({
    where: { clientId_service: { clientId, service } },
    create: {
      clientId,
      service,
      username: username.trim(),
      passwordEncrypted,
    },
    update: {
      username: username.trim(),
      passwordEncrypted,
      // Reset status on credential update
      lastStatus: null,
      lastError: null,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    orgId: session.user.orgId,
    action: "CREATE",
    entity: "BureauCredential",
    entityId: clientId,
    detail: { service, username: username.trim() },
  })

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/reports/import`)

  return { ok: true }
}

// ─── deleteBureauCredential ───────────────────────────────────────────────────

export async function deleteBureauCredential(
  credentialId: string
): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Not authenticated")
  if (!can(session.user.role, "clients:write")) throw new Error("Forbidden")

  // Fetch to verify ownership via client.orgId
  const cred = await db.bureauCredential.findUnique({
    where: { id: credentialId },
    include: { client: { select: { id: true, orgId: true } } },
  })
  if (!cred) throw new Error("Credential not found")
  if (cred.client.orgId !== session.user.orgId) throw new Error("Forbidden")

  await db.bureauCredential.delete({ where: { id: credentialId } })

  await writeAuditLog({
    actorId: session.user.id,
    orgId: session.user.orgId,
    action: "DELETE",
    entity: "BureauCredential",
    entityId: credentialId,
    detail: { service: cred.service, clientId: cred.clientId },
  })

  revalidatePath(`/clients/${cred.clientId}`)
  revalidatePath(`/clients/${cred.clientId}/reports/import`)
}

// ─── getBureauCredentials ─────────────────────────────────────────────────────

export async function getBureauCredentials(
  clientId: string
): Promise<BureauCredentialPublic[]> {
  const session = await auth()
  if (!session?.user?.id) return []
  if (!can(session.user.role, "clients:read")) return []

  const creds = await db.bureauCredential.findMany({
    where: { clientId, client: { orgId: session.user.orgId } },
    select: {
      id: true,
      service: true,
      username: true,
      lastFetchAt: true,
      lastStatus: true,
      lastError: true,
    },
    orderBy: { service: "asc" },
  })

  return creds
}

// ─── triggerReportFetch ───────────────────────────────────────────────────────

export async function triggerReportFetch(
  clientId: string,
  credentialId: string
): Promise<{ jobId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not authenticated" }
  if (!can(session.user.role, "clients:write")) return { error: "Forbidden" }

  // Fetch credential and verify org ownership
  const cred = await db.bureauCredential.findUnique({
    where: { id: credentialId },
    include: { client: { select: { id: true, orgId: true } } },
  })
  if (!cred) return { error: "Credential not found" }
  if (cred.clientId !== clientId) return { error: "Credential does not belong to this client" }
  if (cred.client.orgId !== session.user.orgId) return { error: "Forbidden" }

  // Decrypt password for the fetch worker
  let password: string
  try {
    password = decryptPII(cred.passwordEncrypted)
  } catch {
    return { error: "Failed to decrypt credential — please re-save the password" }
  }

  // Mark as pending immediately
  await db.bureauCredential.update({
    where: { id: credentialId },
    data: { lastStatus: "pending", lastError: null },
  })

  // Fire-and-forget POST to internal fetch API
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001"
  const secret = process.env.INTERNAL_API_SECRET ?? ""

  // We call fetch without awaiting the body — it runs async in the background
  const markFailed = (lastError: string) =>
    db.bureauCredential
      .update({ where: { id: credentialId }, data: { lastStatus: "failed", lastError } })
      .catch(() => {})

  fetch(`${baseUrl}/api/bureau/fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      clientId,
      credentialId,
      service: cred.service,
      username: cred.username,
      password,
    }),
    // Node fetch signal for 90-second timeout
    signal: AbortSignal.timeout(90_000),
  })
    .then(res => {
      // fetch only rejects on network error — a non-2xx (e.g. 401 secret
      // mismatch) resolves normally and would otherwise leave the credential
      // stuck in "pending" forever, with the UI polling indefinitely.
      if (!res.ok) markFailed(`Fetch service returned ${res.status}`)
    })
    .catch(() => {
      // Non-blocking — update status to failed if the request itself failed
      markFailed("Internal fetch request failed")
    })

  await writeAuditLog({
    actorId: session.user.id,
    orgId: session.user.orgId,
    action: "CREATE",
    entity: "BureauFetch",
    entityId: credentialId,
    detail: { service: cred.service, clientId },
  })

  revalidatePath(`/clients/${clientId}/reports/import`)

  return { jobId: credentialId }
}
