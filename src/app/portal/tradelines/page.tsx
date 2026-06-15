import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { getPortalClient } from "@/lib/portal"
import { writeAuditLog } from "@/lib/audit"
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatLimit, cardAgeYears } from "@/lib/tradeline-utils"

export default async function PortalTradelinesPage() {
  const { client, session } = await getPortalClient()

  const orders = await db.tradelineOrder.findMany({
    where: { clientId: client.id },
    include: {
      tradeline: {
        select: {
          bank: true,
          creditLimitCents: true,
          cardOpenedDate: true,
          statementDate: true,
          vendor: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "PortalTradelines",
    entityId: client.id,
  }).catch(() => {})

  const activeOrders = orders.filter(o => !["REMOVED", "CANCELLED"].includes(o.status))
  const pastOrders = orders.filter(o => o.status === "REMOVED" || o.status === "CANCELLED")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Tradeline Orders</h1>
        <p className="text-muted text-sm mt-1">Track the status of authorized user accounts being added on your behalf.</p>
      </div>

      {/* Compliance disclosure — no guarantee language per CROA */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-xs text-yellow-800 leading-relaxed">
          <strong>Important disclosure:</strong> We cannot guarantee that any tradeline will post to your credit report or remain for any specific period. Results vary based on bureau reporting practices and individual account history. Tradeline services are provided on a best-effort basis only.
        </p>
      </div>

      {/* Active orders */}
      <div>
        <h2 className="text-base font-semibold text-ink mb-4">Active Orders ({activeOrders.length})</h2>

        {activeOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-secondary-soft p-10 text-center">
            <p className="text-muted">No active tradeline orders. Contact your consultant to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map(o => {
              const colors = ORDER_STATUS_COLORS[o.status]
              const age = cardAgeYears(o.tradeline.cardOpenedDate)

              return (
                <div key={o.id} className="bg-white rounded-xl border border-secondary-soft p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-ink">{o.tradeline.bank}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                        {o.postedVerifiedAt && (
                          <span className="text-xs bg-green-50 text-success font-medium px-2 py-0.5 rounded-full">
                            ✓ Posting Verified {new Date(o.postedVerifiedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {formatLimit(o.tradeline.creditLimitCents)} credit limit · {age} year{age !== 1 ? "s" : ""} old · statement closes day {o.tradeline.statementDate}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-ink">{formatLimit(o.pricePaidCents)}</p>
                      {o.removalDate && (
                        <p className="text-xs text-muted">Removal: {new Date(o.removalDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Status timeline */}
                  <div className="mt-4 flex items-center gap-0">
                    {(["PENDING_PAYMENT", "PAID", "INFO_SENT_TO_VENDOR", "POSTED", "REMOVED"] as const).map((step, i, arr) => {
                      const statuses = ["PENDING_PAYMENT", "PAID", "INFO_SENT_TO_VENDOR", "POSTED", "REMOVED"]
                      const currentIdx = statuses.indexOf(o.status)
                      const stepIdx = statuses.indexOf(step)
                      const done = stepIdx < currentIdx
                      const current = stepIdx === currentIdx
                      return (
                        <div key={step} className="flex items-center flex-1 min-w-0">
                          <div className="flex flex-col items-center">
                            <div className={`w-2.5 h-2.5 rounded-full ${done ? "bg-success" : current ? "bg-primary" : "bg-secondary-soft"}`} />
                            <p className={`text-[10px] mt-1 text-center leading-tight ${current ? "text-primary font-medium" : "text-muted"}`}>
                              {ORDER_STATUS_LABELS[step]}
                            </p>
                          </div>
                          {i < arr.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1 -mt-4 ${done || current ? "bg-primary/30" : "bg-secondary-soft"}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Past orders */}
      {pastOrders.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-muted mb-4">History</h2>
          <div className="space-y-2">
            {pastOrders.map(o => {
              const colors = ORDER_STATUS_COLORS[o.status]
              return (
                <div key={o.id} className="bg-white rounded-xl border border-secondary-soft p-4 opacity-70 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink">{o.tradeline.bank} — {formatLimit(o.tradeline.creditLimitCents)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                      {o.postedVerifiedAt && <span className="text-xs text-success">✓ Verified</span>}
                    </div>
                  </div>
                  <p className="text-sm text-muted">{formatLimit(o.pricePaidCents)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
