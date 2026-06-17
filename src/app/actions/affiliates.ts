"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { hash } from "bcryptjs"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"

async function requireManager() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "clients:write")) return null
  return session
}

export async function createAffiliate(opts: {
  name: string
  email: string
  password: string
  commissionPct: number
}): Promise<{ id: string } | { error: string }> {
  const session = await requireManager()
  if (!session) return { error: "Unauthorized" }

  if (!opts.name.trim() || !opts.email.trim()) return { error: "Name and email are required" }
  if (opts.commissionPct < 0 || opts.commissionPct > 100) return { error: "Commission must be 0–100%" }

  const existing = await db.user.findUnique({ where: { email: opts.email } })
  if (existing) return { error: "Email already in use" }

  const passwordHash = await hash(opts.password, 12)
  const code = nanoid(8).toUpperCase()

  const orgId = session.user.orgId
  const user = await db.user.create({
    data: {
      name: opts.name.trim(),
      email: opts.email.trim().toLowerCase(),
      passwordHash,
      role: "AFFILIATE",
      orgId,
      affiliate: {
        create: { code, commissionPct: opts.commissionPct, orgId },
      },
    },
  })

  revalidatePath("/affiliates")
  return { id: user.id }
}

export async function updateAffiliate(
  affiliateId: string,
  opts: { commissionPct?: number; active?: boolean }
): Promise<{ ok: true } | { error: string }> {
  const session = await requireManager()
  if (!session) return { error: "Unauthorized" }

  await db.affiliate.update({ where: { id: affiliateId }, data: opts })
  revalidatePath("/affiliates")
  return { ok: true }
}

export async function markReferralPaid(
  referralId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireManager()
  if (!session) return { error: "Unauthorized" }

  await db.referral.update({
    where: { id: referralId },
    data: { paidAt: new Date() },
  })
  revalidatePath("/affiliates")
  return { ok: true }
}

// Called when creating a client via an affiliate link
export async function linkReferral(opts: {
  clientId: string
  affiliateCode: string
  firstInvoiceCents?: number
}): Promise<void> {
  const affiliate = await db.affiliate.findUnique({
    where: { code: opts.affiliateCode, active: true },
  })
  if (!affiliate) return

  const commissionCents = opts.firstInvoiceCents
    ? Math.round((opts.firstInvoiceCents * affiliate.commissionPct) / 100)
    : undefined

  await db.referral.upsert({
    where: { clientId: opts.clientId },
    create: { affiliateId: affiliate.id, clientId: opts.clientId, commissionCents },
    update: {},
  })
}
