import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"

export default async function AffiliatesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "clients:write")) redirect("/dashboard")
  const { orgId } = session.user

  const affiliates = await db.affiliate.findMany({
    where: { orgId },
    include: {
      user: { select: { name: true, email: true } },
      referrals: {
        include: {
          client: { select: { firstName: true, lastName: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const totalUnpaidCents = affiliates.reduce((sum, a) =>
    sum + a.referrals.filter(r => !r.paidAt && r.commissionCents).reduce((s, r) => s + (r.commissionCents ?? 0), 0),
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Affiliates</h1>
          <p className="text-sm text-muted mt-1">
            {affiliates.filter(a => a.active).length} active affiliates
            {totalUnpaidCents > 0 && (
              <span className="ml-2 text-warning font-medium">· ${(totalUnpaidCents / 100).toLocaleString()} pending payout</span>
            )}
          </p>
        </div>
        <Link href="/affiliates/new" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors">
          + Add Affiliate
        </Link>
      </div>

      {affiliates.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-soft p-12 text-center">
          <p className="text-muted text-sm">No affiliates yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {affiliates.map(a => {
            const totalEarned = a.referrals.reduce((s, r) => s + (r.commissionCents ?? 0), 0)
            const unpaid = a.referrals.filter(r => !r.paidAt && r.commissionCents).reduce((s, r) => s + (r.commissionCents ?? 0), 0)
            const activeClients = a.referrals.filter(r => ["ACTIVE", "SIGNED"].includes(r.client.status)).length

            return (
              <div key={a.id} className={`bg-white rounded-xl border border-secondary-soft p-5 ${!a.active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-ink">{a.user.name}</h2>
                      <span className="text-xs font-mono bg-secondary-soft px-2 py-0.5 rounded">{a.code}</span>
                      {!a.active && <span className="text-xs bg-secondary-soft text-muted px-2 py-0.5 rounded-full">Inactive</span>}
                    </div>
                    <p className="text-sm text-muted mt-0.5">{a.user.email} · {a.commissionPct}% commission</p>
                  </div>
                  <div className="flex gap-6 text-right shrink-0">
                    <div>
                      <p className="text-xs text-muted">Referrals</p>
                      <p className="text-sm font-semibold text-ink">{a.referrals.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Active clients</p>
                      <p className="text-sm font-semibold text-ink">{activeClients}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Total earned</p>
                      <p className="text-sm font-semibold text-success">${(totalEarned / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Unpaid</p>
                      <p className={`text-sm font-semibold ${unpaid > 0 ? "text-warning" : "text-muted"}`}>${(unpaid / 100).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {a.referrals.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-secondary-soft">
                    <p className="text-xs text-muted mb-2">Recent referrals</p>
                    <div className="space-y-1">
                      {a.referrals.slice(0, 5).map(r => (
                        <div key={r.id} className="flex items-center justify-between text-xs">
                          <span className="text-ink">{r.client.firstName} {r.client.lastName}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted">{r.client.status}</span>
                            {r.commissionCents ? (
                              <span className={r.paidAt ? "text-success" : "text-warning"}>
                                ${(r.commissionCents / 100).toLocaleString()} {r.paidAt ? "paid" : "pending"}
                              </span>
                            ) : <span className="text-muted">—</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Link href={`/affiliates/${a.id}/edit`} className="text-xs text-primary hover:underline">Edit</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
