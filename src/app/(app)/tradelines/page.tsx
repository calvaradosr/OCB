import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import { cardAgeYears, formatLimit } from "@/lib/tradeline-utils"

export default async function TradelinesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "tradelines:read")) redirect("/dashboard")
  const { orgId } = session.user

  const tradelines = await db.tradeline.findMany({
    where: { orgId },
    include: {
      vendor: { select: { name: true } },
      _count: { select: { orders: true } },
      orders: {
        where: { status: { in: ["INFO_SENT_TO_VENDOR", "POSTED"] } },
        select: { id: true, status: true, postedVerifiedAt: true },
      },
    },
    orderBy: [{ active: "desc" }, { availableAuSpots: "desc" }],
  })

  const canWrite = can(session.user.role, "tradelines:write")

  const available = tradelines.filter(t => t.active && t.availableAuSpots > 0)
  const full = tradelines.filter(t => t.active && t.availableAuSpots === 0)
  const inactive = tradelines.filter(t => !t.active)

  const totalAvailableSpots = available.reduce((s, t) => s + t.availableAuSpots, 0)
  const totalRetailValueCents = tradelines
    .filter(t => t.active)
    .reduce((s, t) => s + t.retailPriceCents * t.availableAuSpots, 0)
  const activeOrders = tradelines.reduce((s, t) => s + t.orders.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Tradelines</h1>
          <p className="text-muted text-sm mt-1">
            {available.length} available · {full.length} full · {inactive.length} inactive
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/tradelines/vendors" className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">
            Vendors
          </Link>
          {canWrite && (
            <Link href="/tradelines/new" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
              + Add Tradeline
            </Link>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Available spots</p>
          <p className="text-2xl font-semibold text-ink mt-1">{totalAvailableSpots}</p>
          <p className="text-xs text-muted mt-0.5">across {available.length} tradelines</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Inventory retail value</p>
          <p className="text-2xl font-semibold text-ink mt-1">
            {totalRetailValueCents > 0 ? `$${(totalRetailValueCents / 100).toLocaleString()}` : "—"}
          </p>
          <p className="text-xs text-muted mt-0.5">available spots only</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Active orders</p>
          <p className="text-2xl font-semibold text-ink mt-1">{activeOrders}</p>
          <p className="text-xs text-muted mt-0.5">in progress</p>
        </div>
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <p className="text-xs text-muted">Total tradelines</p>
          <p className="text-2xl font-semibold text-ink mt-1">{tradelines.filter(t => t.active).length}</p>
          <p className="text-xs text-muted mt-0.5">{inactive.length} inactive</p>
        </div>
      </div>

      {/* Inventory table label */}
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Inventory</h2>

      {tradelines.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-soft p-12 text-center">
          <p className="text-muted">No tradelines in inventory yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Bank / Vendor</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Limit</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Age</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Statement</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Spots</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Cost / Retail</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Orders</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Status</th>
                {canWrite && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {tradelines.map(t => {
                const postedCount = t.orders.filter(o => o.postedVerifiedAt).length
                const activeCount = t.orders.length
                return (
                  <tr key={t.id} className={`hover:bg-secondary-soft/30 ${!t.active ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{t.bank}</p>
                      <p className="text-xs text-muted">{t.vendor.name}</p>
                    </td>
                    <td className="px-5 py-3 font-semibold text-ink">{formatLimit(t.creditLimitCents)}</td>
                    <td className="px-5 py-3 text-muted">{cardAgeYears(t.cardOpenedDate)}y</td>
                    <td className="px-5 py-3 text-muted">Day {t.statementDate}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.availableAuSpots > 0
                          ? "bg-green-50 text-success"
                          : "bg-secondary-soft text-muted"
                      }`}>
                        {t.availableAuSpots}/{t.totalAuSpots}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <span className="text-muted">{formatLimit(t.costCents)}</span>
                      {" / "}
                      <span className="font-medium text-ink">{formatLimit(t.retailPriceCents)}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {activeCount > 0 ? (
                        <>
                          {activeCount} active
                          {postedCount > 0 && (
                            <span className="ml-1 text-success">· {postedCount} verified</span>
                          )}
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium ${t.active ? "text-success" : "text-muted"}`}>
                        {t.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3">
                        <Link href={`/tradelines/${t.id}`} className="text-xs text-primary hover:underline">
                          View
                        </Link>
                      </td>
                    )}
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
