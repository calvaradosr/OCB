import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import { formatLimit } from "@/lib/tradeline-utils"

export default async function VendorsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "tradelines:read")) redirect("/dashboard")
  const { orgId } = session.user

  const vendors = await db.tradelineVendor.findMany({
    where: { orgId },
    include: {
      tradelines: {
        select: {
          id: true,
          bank: true,
          creditLimitCents: true,
          retailPriceCents: true,
          availableAuSpots: true,
          totalAuSpots: true,
          active: true,
        },
      },
      _count: { select: { tradelines: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })

  const canWrite = can(session.user.role, "tradelines:write")

  // Compute order totals per vendor from tradelines' orders
  const vendorStats = await db.tradelineOrder.groupBy({
    by: ["tradelineId"],
    where: {
      orgId,
      status: { notIn: ["CANCELLED"] },
    },
    _count: { id: true },
    _sum: { pricePaidCents: true },
  })

  // Map tradelineId → stats
  const statsByTradeline = new Map(vendorStats.map(s => [s.tradelineId, s]))

  // Aggregate per vendor
  const vendorAgg = vendors.map(v => {
    let totalOrders = 0
    let totalRevenueCents = 0
    for (const tl of v.tradelines) {
      const s = statsByTradeline.get(tl.id)
      if (s) {
        totalOrders += s._count.id
        totalRevenueCents += s._sum.pricePaidCents ?? 0
      }
    }
    return { ...v, totalOrders, totalRevenueCents }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/tradelines" className="text-sm text-muted hover:text-ink transition-colors">← Tradelines</Link>
          </div>
          <h1 className="text-2xl font-semibold text-ink">Tradeline Vendors</h1>
          <p className="text-sm text-muted mt-1">{vendors.filter(v => v.active).length} active vendors</p>
        </div>
        {canWrite && (
          <Link href="/tradelines/vendors/new" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
            + Add Vendor
          </Link>
        )}
      </div>

      {vendors.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-soft p-12 text-center">
          <p className="text-muted">No vendors yet. Add your first tradeline vendor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vendorAgg.map(v => (
            <div key={v.id} className={`bg-white rounded-xl border border-secondary-soft p-5 ${!v.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-ink">{v.name}</h2>
                    {!v.active && (
                      <span className="text-xs bg-secondary-soft text-muted px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <div className="text-sm text-muted mt-0.5 space-x-4">
                    {v.contactName && <span>{v.contactName}</span>}
                    {v.contactEmail && <a href={`mailto:${v.contactEmail}`} className="hover:text-ink">{v.contactEmail}</a>}
                    {v.contactPhone && <span>{v.contactPhone}</span>}
                    {v.payoutTerms && <span className="text-xs bg-secondary-soft px-2 py-0.5 rounded-full">{v.payoutTerms}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <p className="text-xs text-muted">Tradelines</p>
                    <p className="text-sm font-semibold text-ink">{v._count.tradelines}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Orders</p>
                    <p className="text-sm font-semibold text-ink">{v.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Revenue</p>
                    <p className="text-sm font-semibold text-success">{formatLimit(v.totalRevenueCents)}</p>
                  </div>
                  {canWrite && (
                    <Link href={`/tradelines/vendors/${v.id}/edit`} className="text-xs text-primary hover:underline">
                      Edit
                    </Link>
                  )}
                </div>
              </div>

              {v.tradelines.length > 0 && (
                <div className="mt-4 pt-4 border-t border-secondary-soft">
                  <p className="text-xs text-muted mb-2">Tradelines from this vendor</p>
                  <div className="flex flex-wrap gap-2">
                    {v.tradelines.map(tl => (
                      <Link
                        key={tl.id}
                        href={`/tradelines/${tl.id}`}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          tl.active && tl.availableAuSpots > 0
                            ? "border-success/30 text-success bg-green-50 hover:bg-green-100"
                            : "border-secondary-soft text-muted hover:text-ink"
                        }`}
                      >
                        {tl.bank} — {formatLimit(tl.creditLimitCents)}
                        {tl.active ? ` (${tl.availableAuSpots}/${tl.totalAuSpots} spots)` : " (inactive)"}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
