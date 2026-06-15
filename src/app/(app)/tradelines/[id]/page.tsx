import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import Link from "next/link"
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  VALID_ORDER_TRANSITIONS,
  cardAgeYears,
  formatLimit,
} from "@/lib/tradeline-utils"
import { TradelineOrderStatus } from "@prisma/client"
import OrderStatusButton from "./OrderStatusButton"
import TradelineEditInline from "./TradelineEditInline"

export default async function TradelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "tradelines:read")) redirect("/dashboard")

  const tradeline = await db.tradeline.findUnique({
    where: { id },
    include: {
      vendor: true,
      orders: {
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!tradeline) notFound()

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "Tradeline",
    entityId: id,
  }).catch(() => {})

  const canWrite = can(session.user.role, "tradelines:write")
  const age = cardAgeYears(tradeline.cardOpenedDate)
  const commission = tradeline.retailPriceCents - tradeline.costCents

  const activeOrders = tradeline.orders.filter(
    o => !["REMOVED", "CANCELLED"].includes(o.status)
  )
  const completedOrders = tradeline.orders.filter(
    o => o.status === "REMOVED" || o.status === "CANCELLED"
  )
  const verifiedCount = tradeline.orders.filter(o => o.postedVerifiedAt).length

  const vendors = await db.tradelineVendor.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/tradelines" className="text-sm text-muted hover:text-ink transition-colors">
        ← Tradeline Inventory
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-ink">{tradeline.bank}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tradeline.active ? "bg-green-50 text-success" : "bg-secondary-soft text-muted"}`}>
                {tradeline.active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-muted text-sm">Vendor: {tradeline.vendor.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: "Credit Limit", value: formatLimit(tradeline.creditLimitCents) },
            { label: "Card Age", value: `${age} year${age !== 1 ? "s" : ""}` },
            { label: "Statement Day", value: `Day ${tradeline.statementDate}` },
            { label: "AU Spots", value: `${tradeline.availableAuSpots}/${tradeline.totalAuSpots} available` },
            { label: "Our Cost", value: formatLimit(tradeline.costCents) },
            { label: "Retail Price", value: formatLimit(tradeline.retailPriceCents) },
            { label: "Commission", value: formatLimit(commission), highlight: true },
            { label: "Posting Rate", value: verifiedCount > 0 ? `${verifiedCount}/${tradeline.orders.length} verified` : "—" },
          ].map(({ label, value, highlight }) => (
            <div key={label}>
              <p className="text-xs text-muted">{label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${highlight ? "text-success" : "text-ink"}`}>{value}</p>
            </div>
          ))}
        </div>

        {tradeline.notes && (
          <p className="mt-4 pt-4 border-t border-secondary-soft text-sm text-muted">{tradeline.notes}</p>
        )}
      </div>

      {/* Edit panel */}
      {canWrite && (
        <TradelineEditInline
          tradelineId={id}
          vendors={vendors}
          defaults={{
            vendorId: tradeline.vendorId,
            bank: tradeline.bank,
            creditLimitDollars: String(tradeline.creditLimitCents / 100),
            cardOpenedDate: tradeline.cardOpenedDate.toISOString().slice(0, 10),
            statementDate: String(tradeline.statementDate),
            totalAuSpots: String(tradeline.totalAuSpots),
            costDollars: String(tradeline.costCents / 100),
            retailPriceDollars: String(tradeline.retailPriceCents / 100),
            notes: tradeline.notes ?? "",
            active: tradeline.active,
          }}
        />
      )}

      {/* Active orders */}
      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-soft flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Active Orders ({activeOrders.length})
          </h2>
        </div>

        {activeOrders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No active orders.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Client</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">AU Name</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Status</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Posting</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Removal</th>
                {canWrite && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {activeOrders.map(o => {
                const colors = ORDER_STATUS_COLORS[o.status]
                const allowedNext = VALID_ORDER_TRANSITIONS[o.status] ?? []
                return (
                  <tr key={o.id} className="hover:bg-secondary-soft/30">
                    <td className="px-5 py-3">
                      <Link href={`/clients/${o.client.id}/tradelines`} className="text-primary hover:underline">
                        {o.client.firstName} {o.client.lastName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {o.auFirstName} {o.auLastName}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {o.postedVerifiedAt ? (
                        <span className="text-xs text-success font-medium">✓ Verified {new Date(o.postedVerifiedAt).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-xs text-muted">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {o.removalDate ? new Date(o.removalDate).toLocaleDateString() : "—"}
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3">
                        <OrderStatusButton
                          orderId={o.id}
                          currentStatus={o.status}
                          allowedNext={allowedNext as TradelineOrderStatus[]}
                          vendorPaidAt={o.vendorPaidAt?.toISOString() ?? null}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Completed / cancelled orders */}
      {completedOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-soft">
            <h2 className="text-sm font-semibold text-muted">Completed / Cancelled ({completedOrders.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Client</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Status</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Posted</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Commission</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Vendor paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {completedOrders.map(o => {
                const colors = ORDER_STATUS_COLORS[o.status]
                return (
                  <tr key={o.id} className="opacity-60 hover:opacity-100">
                    <td className="px-5 py-3 text-muted">{o.client.firstName} {o.client.lastName}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {o.postedVerifiedAt ? <span className="text-success">✓</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {o.commissionCents ? formatLimit(o.commissionCents) : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {o.vendorPaidAt ? new Date(o.vendorPaidAt).toLocaleDateString() : "Unpaid"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
