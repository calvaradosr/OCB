"use server"
import { redirect } from "next/navigation"
import { auth, unstable_update } from "@/auth"
import { db } from "@/lib/db"
import { verifyTOTP, generateTOTPSecret } from "@/lib/mfa"
import { writeAuditLog } from "@/lib/audit"

// Called from the /auth/mfa-verify form after a successful password sign-in.
export async function verifyMFACode(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const code = (formData.get("code") as string)?.replace(/\s/g, "")
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.mfaSecret || !user.mfaEnabled) redirect("/login")

  const valid = await verifyTOTP(code, user.mfaSecret)
  if (!valid) return { error: "Invalid code. Check your authenticator and try again." }

  await unstable_update({ user: { mfaVerified: true } })
  redirect("/dashboard")
}

// Called from the /auth/mfa-setup form to confirm and enable MFA.
export async function confirmMFASetup(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const code = (formData.get("code") as string)?.replace(/\s/g, "")
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect("/login")

  // Secret was pre-generated and stored when the setup page was loaded
  if (!user.mfaSecret) return { error: "Setup not initialized. Reload the page." }

  const valid = await verifyTOTP(code, user.mfaSecret)
  if (!valid) return { error: "Invalid code. Scan the QR code again and try." }

  await db.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  })

  await writeAuditLog({
    actorId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    detail: { field: "mfaEnabled", value: true },
  })

  await unstable_update({ user: { mfaEnabled: true, mfaVerified: true } })
  redirect("/dashboard")
}

// Idempotently provisions a TOTP secret for the current user if not set.
// Returns the secret string for QR code display (server component use only).
export async function ensureMFASecret(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) redirect("/login")

  if (user.mfaSecret) return user.mfaSecret

  const secret = generateTOTPSecret()
  await db.user.update({ where: { id: user.id }, data: { mfaSecret: secret } })
  return secret
}
