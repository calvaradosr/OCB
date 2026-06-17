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
  formatLimit,
  cardAgeYears,
} from "@/lib/tradeline-utils"
import { TradelineOrderStatus } from "@prisma/client"
import OrderStatusButton from "@/app/(app)/tradelines/[id]/OrderStatusButton"
import AssignButton from "./AssignButton"

export default async function ClientTradelinesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "tradelines:read")) redirect("/dashboard")

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  const orders = await db.tradelineOrder.findMany({
    where: { clientId },
    include: {
      tradeline: {
        include: { vendor: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "ClientTradelines",
    entityId: clientId,
  }).catch(() => {})

  const canWrite = can(session.user.role, "tradelines:write")

  // Available tradelines for assignment
  const availableTradelines = canWrite
    ? await db.tradeline.findMany({
        where: { active: true, availableAuSpots: { gte: 1 } },
        include: { vendor: { select: { name: true } } },
        orderBy: [{ creditLimitCents: "desc" }],
      })
    : []

  const activeOrders = orders.filter(o => !["REMOVED", "CANCELLED"].includes(o.status))
  const pastOrders = orders.filter(o => o.status === "REMOVED" || o.status === "CANCELLED")

  const PIPELINE_STEPS = ["Pending Payment", "Paid", "Info to Vendor", "Posted", "Removed"]
  const STATUS_STEP: Record<string, number> = {
    PENDING_PAYMENT: 0, PAID: 1, INFO_SENT_TO_VENDOR: 2, POSTED: 3, REMOVED: 4
  }

  return (
    <div className="max-w-4xl space-y-6">
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${clientId}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <span className="text-ink font-medium">Tradelines</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Tradeline Orders</h1>
          <p className="text-sm text-muted mt-1">
            {activeOrders.length} active · {pastOrders.length} completed
          </p>
        </div>
        {canWrite && (
          <AssignButton clientId={clientId} tradelines={availableTradelines} />
        )}
      </div>

      {/* Active orders */}
      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-soft">
          <h2 className="text-sm font-semibold text-ink">Active Orders ({activeOrders.length})</h2>
        </div>

        {activeOrders.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-muted text-sm">No active tradeline orders.</p>
            {canWrite && (
              <p className="text-xs text-muted mt-1">Use the &quot;Assign Tradeline&quot; button to add AU spots for this client.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-secondary-soft">
            {activeOrders.map(o => {
              const colors = ORDER_STATUS_COLORS[o.status]
              const allowedNext = VALID_ORDER_TRANSITIONS[o.status] ?? []
              const age = cardAgeYears(o.tradeline.cardOpenedDate)
              const currentStep = STATUS_STEP[o.status] ?? 0

              return (
                <div key={o.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/tradelines/${o.tradeline.id}`} className="text-sm font-semibold text-ink hover:text-primary">
                          {o.tradeline.bank}
                        </Link>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                        {o.postedVerifiedAt && (
                          <span className="text-xs text-success font-medium">✓ Verified</span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {o.tradeline.vendor.name} · {formatLimit(o.tradeline.creditLimitCents)} limit · {age}y old · closes day {o.tradeline.statementDate}
                      </p>
                      <p className="text-xs text-muted">
                        AU: {o.auFirstName} {o.auLastName}
                        {o.removalDate && ` · remove by ${new Date(o.removalDate).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-ink">{formatLimit(o.pricePaidCents ?? 0)}</p>
                      <p className="text-xs text-muted">Commission: {formatLimit(o.commissionCents ?? 0)}</p>
                      {o.vendorPaidAt && (
                        <p className="text-xs text-success mt-0.5">Vendor paid {new Date(o.vendorPaidAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Mini pipeline stepper */}
                  <div className="flex items-center gap-0">
                    {PIPELINE_STEPS.slice(0, -1).map((step, i) => {
                      const done = currentStep > i
                      const active = currentStep === i
                      return (
                        <div key={step} className="flex items-center">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                            ${done ? "text-success" : active ? "text-primary" : "text-muted"}`}>
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px]
                              ${done ? "bg-success text-white" : active ? "bg-primary text-white" : "bg-secondary-soft text-muted"}`}>
                              {done ? "✓" : i + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                          {i < PIPELINE_STEPS.length - 2 && (
                            <span className={`text-xs ${done ? "text-success" : "text-secondary-soft"}`}>›</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {canWrite && allowedNext.length > 0 && (
                    <OrderStatusButton
                      orderId={o.id}
                      currentStatus={o.status}
                      allowedNext={allowedNext as TradelineOrderStatus[]}
                      vendorPaidAt={o.vendorPaidAt?.toISOString() ?? null}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Past orders */}
      {pastOrders.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-soft">
            <h2 className="text-sm font-semibold text-muted">History ({pastOrders.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Tradeline</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Status</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Posted</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {pastOrders.map(o => {
                const colors = ORDER_STATUS_COLORS[o.status]
                return (
                  <tr key={o.id} className="opacity-60">
                    <td className="px-5 py-3 text-muted">{o.tradeline.bank}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {o.postedVerifiedAt ? <span className="text-success">✓ Verified</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{formatLimit(o.pricePaidCents ?? 0)}</td>
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
