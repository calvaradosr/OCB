"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { TradelineOrderStatus } from "@prisma/client"
import { canOrderTransition, calcCommission } from "@/lib/tradeline-utils"
import { encrypt, decryptPII } from "@/lib/crypto"
import { revalidatePath } from "next/cache"

async function requireTradelineWrite() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "tradelines:write")) return null
  return session
}

async function requireTradelineRead() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "tradelines:read")) return null
  return session
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

export async function createVendor(opts: {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  payoutTerms?: string
}): Promise<{ id: string } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  const vendor = await db.tradelineVendor.create({ data: { ...opts, orgId: session.user.orgId } })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "TradelineVendor",
    entityId: vendor.id,
    detail: { name: opts.name },
  })

  revalidatePath("/tradelines/vendors")
  return { id: vendor.id }
}

export async function updateVendor(
  vendorId: string,
  opts: {
    name?: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    payoutTerms?: string | null
    active?: boolean
  }
): Promise<{ ok: true } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  // Scope to caller's org so one tenant can't update another tenant's vendor.
  const res = await db.tradelineVendor.updateMany({
    where: { id: vendorId, orgId: session.user.orgId },
    data: opts,
  })
  if (res.count === 0) return { error: "Vendor not found" }

  revalidatePath("/tradelines/vendors")
  return { ok: true }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function createTradeline(opts: {
  vendorId: string
  bank: string
  creditLimitCents: number
  cardOpenedDate: Date
  statementDate: number
  totalAuSpots: number
  costCents: number
  retailPriceCents: number
  notes?: string
}): Promise<{ id: string } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  const tradeline = await db.tradeline.create({
    data: {
      ...opts,
      orgId: session.user.orgId,
      availableAuSpots: opts.totalAuSpots,
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Tradeline",
    entityId: tradeline.id,
    detail: { bank: opts.bank, creditLimitCents: opts.creditLimitCents },
  })

  revalidatePath("/tradelines")
  return { id: tradeline.id }
}

export async function updateTradeline(
  tradelineId: string,
  opts: {
    bank?: string
    creditLimitCents?: number
    cardOpenedDate?: Date
    statementDate?: number
    totalAuSpots?: number
    availableAuSpots?: number
    costCents?: number
    retailPriceCents?: number
    notes?: string | null
    active?: boolean
  }
): Promise<{ ok: true } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  await db.tradeline.update({ where: { id: tradelineId }, data: opts })
  revalidatePath("/tradelines")
  revalidatePath(`/tradelines/${tradelineId}`)
  return { ok: true }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function createTradelineOrder(opts: {
  clientId: string
  tradelineId: string
  auFirstName: string
  auLastName: string
  auAddress: string
  auDob?: string     // plaintext — will be encrypted
  auSsn?: string     // plaintext — will be encrypted
  removalDate?: Date
}): Promise<{ id: string } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  const tradeline = await db.tradeline.findUnique({ where: { id: opts.tradelineId } })
  if (!tradeline) return { error: "Tradeline not found" }
  if (tradeline.availableAuSpots < 1) return { error: "No available AU spots on this tradeline" }

  const client = await db.client.findUnique({ where: { id: opts.clientId } })
  if (!client) return { error: "Client not found" }

  // Encrypt PII
  const auDobEncrypted = opts.auDob ? encrypt(opts.auDob) : undefined
  const auSsnEncrypted = opts.auSsn ? encrypt(opts.auSsn) : undefined

  const order = await db.tradelineOrder.create({
    data: {
      clientId: opts.clientId,
      orgId: client.orgId,
      tradelineId: opts.tradelineId,
      auFirstName: opts.auFirstName,
      auLastName: opts.auLastName,
      auAddress: opts.auAddress,
      auDobEncrypted,
      auSsnEncrypted,
      removalDate: opts.removalDate,
      vendorCostCents: tradeline.costCents,
      pricePaidCents: tradeline.retailPriceCents,
      commissionCents: calcCommission(tradeline.retailPriceCents, tradeline.costCents),
    },
  })

  // Decrement available spots
  await db.tradeline.update({
    where: { id: opts.tradelineId },
    data: { availableAuSpots: { decrement: 1 } },
  })

  // Ensure TRADELINE module active on client
  if (!client.modules.includes("TRADELINE")) {
    await db.client.update({
      where: { id: opts.clientId },
      data: { modules: { push: "TRADELINE" } },
    })
  }

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "TradelineOrder",
    entityId: order.id,
    detail: { clientId: opts.clientId, tradelineId: opts.tradelineId },
  })

  revalidatePath(`/clients/${opts.clientId}/tradelines`)
  revalidatePath(`/tradelines/${opts.tradelineId}`)
  return { id: order.id }
}

export async function advanceOrderStatus(
  orderId: string,
  newStatus: TradelineOrderStatus
): Promise<{ ok: true } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  const order = await db.tradelineOrder.findFirst({ where: { id: orderId, orgId: session.user.orgId } })
  if (!order) return { error: "Order not found" }

  if (!canOrderTransition(order.status, newStatus)) {
    return { error: `Cannot move from ${order.status} to ${newStatus}` }
  }

  const data: Record<string, unknown> = { status: newStatus }

  if (newStatus === "INFO_SENT_TO_VENDOR") data.infoSentAt = new Date()
  if (newStatus === "CANCELLED") {
    data.cancelledAt = new Date()
    // Return the AU spot to inventory
    await db.tradeline.update({
      where: { id: order.tradelineId },
      data: { availableAuSpots: { increment: 1 } },
    })
  }

  await db.tradelineOrder.update({ where: { id: orderId }, data })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "TradelineOrder",
    entityId: orderId,
    detail: { from: order.status, to: newStatus },
  })

  revalidatePath(`/clients/${order.clientId}/tradelines`)
  revalidatePath(`/tradelines/${order.tradelineId}`)
  return { ok: true }
}

export async function markVendorPaid(
  orderId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  const order = await db.tradelineOrder.findFirst({ where: { id: orderId, orgId: session.user.orgId } })
  if (!order) return { error: "Order not found" }

  await db.tradelineOrder.update({
    where: { id: orderId },
    data: { vendorPaidAt: new Date() },
  })

  revalidatePath(`/tradelines/${order.tradelineId}`)
  return { ok: true }
}

// ─── AU Info Packet ───────────────────────────────────────────────────────────

export async function revealAuPacket(orderId: string): Promise<
  | {
      auFirstName: string | null
      auLastName: string | null
      auAddress: string | null
      auDob: string | null
      auSsn: string | null
      tradelineName: string
      vendorName: string
    }
  | { error: string }
> {
  const session = await requireTradelineRead()
  if (!session) return { error: "Unauthorized" }

  // Scope to caller's org — this returns decrypted SSN/DOB, so a missing
  // tenant check here is a cross-tenant PII disclosure.
  const order = await db.tradelineOrder.findFirst({
    where: { id: orderId, orgId: session.user.orgId },
    include: {
      tradeline: { include: { vendor: { select: { name: true } } } },
    },
  })
  if (!order) return { error: "Order not found" }

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW_PII",
    entity: "TradelineOrder",
    entityId: orderId,
    detail: { fields: ["auDob", "auSsn"] },
  })

  return {
    auFirstName: order.auFirstName,
    auLastName: order.auLastName,
    auAddress: order.auAddress,
    auDob: order.auDobEncrypted ? decryptPII(order.auDobEncrypted) : null,
    auSsn: order.auSsnEncrypted ? decryptPII(order.auSsnEncrypted) : null,
    tradelineName: order.tradeline.bank,
    vendorName: order.tradeline.vendor.name,
  }
}

// ─── Vendor Bulk Payout ───────────────────────────────────────────────────────

export async function markVendorPaidBulk(
  vendorId: string
): Promise<{ ok: true; count: number } | { error: string }> {
  const session = await requireTradelineWrite()
  if (!session) return { error: "Unauthorized" }

  const orders = await db.tradelineOrder.findMany({
    where: {
      orgId: session.user.orgId,
      tradeline: { vendorId },
      vendorPaidAt: null,
      status: { in: ["POSTED", "REMOVED"] },
    },
    select: { id: true },
  })

  if (orders.length === 0) return { ok: true, count: 0 }

  await db.tradelineOrder.updateMany({
    where: { id: { in: orders.map(o => o.id) } },
    data: { vendorPaidAt: new Date() },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "BULK_MARK_PAID",
    entity: "TradelineVendor",
    entityId: vendorId,
    detail: { count: orders.length },
  })

  revalidatePath(`/tradelines/vendors/${vendorId}/edit`)
  revalidatePath("/tradelines/vendors")
  return { ok: true, count: orders.length }
}

// Called after report import: tries to verify posting for all active orders on a client.
// Returns count of newly verified orders.
export async function verifyPostingForClient(
  clientId: string,
  reportId: string
): Promise<number> {
  const activeOrders = await db.tradelineOrder.findMany({
    where: {
      clientId,
      status: { in: ["INFO_SENT_TO_VENDOR", "POSTED"] },
      postedVerifiedAt: null,
    },
    include: { tradeline: { select: { bank: true } } },
  })

  if (activeOrders.length === 0) return 0

  const reportItems = await db.reportItem.findMany({
    where: { reportId },
    select: { creditorName: true, onExperian: true, onEquifax: true, onTransunion: true },
  })

  let verified = 0
  for (const order of activeOrders) {
    const keyword = order.tradeline.bank.toLowerCase().split(/\s+/)[0]
    const found = reportItems.some(item =>
      item.creditorName.toLowerCase().includes(keyword)
    )
    if (found) {
      await db.tradelineOrder.update({
        where: { id: order.id },
        data: {
          postedVerifiedAt: new Date(),
          verifiedReportId: reportId,
          status: "POSTED",
        },
      })
      verified++
    }
  }

  return verified
}
