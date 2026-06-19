"use server"

import { db } from "@/lib/db"
import { linkReferral } from "@/app/actions/affiliates"
import { runAutomations } from "@/lib/automation"

export async function publicLeadSignup(opts: {
  affiliateCode: string
  firstName: string
  lastName: string
  email: string
  phone: string
}): Promise<{ ok: true } | { error: string }> {
  const { affiliateCode, firstName, lastName, email, phone } = opts

  if (!firstName.trim() || !lastName.trim()) return { error: "First and last name are required." }
  if (!email.trim() && !phone.trim()) return { error: "Please provide an email or phone number." }

  const affiliate = await db.affiliate.findUnique({
    where: { code: affiliateCode, active: true },
    include: { user: { select: { name: true } } },
  })
  if (!affiliate) return { error: "Referral link is no longer active." }

  // Duplicate check by email
  if (email.trim()) {
    const existing = await db.client.findFirst({
      where: { orgId: affiliate.orgId, email: email.trim().toLowerCase() },
    })
    if (existing) return { error: "An account with this email already exists. Please contact the office directly." }
  }

  const client = await db.client.create({
    data: {
      orgId: affiliate.orgId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase() || undefined,
      phone: phone.trim() || undefined,
      status: "LEAD",
      modules: ["CREDIT_REPAIR"],
    },
  })

  await linkReferral({ clientId: client.id, affiliateCode })

  // Parity with manual lead creation (createClient) — fire welcome/assignment
  // automations for affiliate-referred leads too. Non-blocking.
  runAutomations({
    trigger: "CLIENT_CREATED",
    clientId: client.id,
    triggeredBy: client.id,
  }).catch(() => {})

  return { ok: true }
}
