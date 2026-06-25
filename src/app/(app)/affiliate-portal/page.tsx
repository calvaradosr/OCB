import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"

export default async function AffiliatePortalPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "AFFILIATE") redirect("/dashboard")

  const affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    include: {
      referrals: {
        include: {
          client: { select: { firstName: true, lastName: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!affiliate) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">No affiliate record found. Contact your administrator.</p>
      </div>
    )
  }

  const totalEarned = affiliate.referrals.reduce((s, r) => s + (r.commissionCents ?? 0), 0)
  const paid = affiliate.referrals.filter(r => r.paidAt).reduce((s, r) => s + (r.commissionCents ?? 0), 0)
  const pending = totalEarned - paid
  const activeClients = affiliate.referrals.filter(r => ["ACTIVE", "SIGNED"].includes(r.client.status)).length

  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3001"
  const signupLink = `${base}/signup/${affiliate.code}`

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Affiliate Dashboard</h1>
        <p className="text-muted text-sm mt-1">Welcome, {session.user.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Referrals", value: String(affiliate.referrals.length) },
          { label: "Active clients", value: String(activeClients) },
          { label: "Total earned", value: `$${(totalEarned / 100).toLocaleString()}`, highlight: true },
          { label: "Pending payout", value: `$${(pending / 100).toLocaleString()}`, warn: pending > 0 },
        ].map(({ label, value, highlight, warn }) => (
          <div key={label} className="bg-white rounded-xl border border-secondary-soft p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className={`text-xl font-semibold mt-1 ${highlight ? "text-success" : warn ? "text-warning" : "text-ink"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="bg-white rounded-xl border border-secondary-soft p-5">
        <h2 className="text-sm font-semibold text-ink mb-2">Your referral link</h2>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-secondary-soft rounded-lg px-3 py-2 text-muted overflow-x-auto">{signupLink}</code>
          <span className="text-xs bg-secondary-soft px-2 py-1 rounded font-mono">{affiliate.code}</span>
        </div>
        <p className="text-xs text-muted mt-2">Share this link — when a client signs up using it, they&apos;ll be attributed to your account at {affiliate.commissionPct}% commission.</p>
      </div>

      {/* Referrals table */}
      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-soft">
          <h2 className="text-sm font-semibold text-ink">Referrals ({affiliate.referrals.length})</h2>
        </div>
        {affiliate.referrals.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted text-center">No referrals yet. Share your link to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Client</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Status</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Joined</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Commission</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {affiliate.referrals.map(r => (
                <tr key={r.id} className="hover:bg-secondary-soft/20">
                  <td className="px-5 py-3 text-ink">{r.client.firstName} {r.client.lastName}</td>
                  <td className="px-5 py-3 text-xs text-muted">{r.client.status}</td>
                  <td className="px-5 py-3 text-xs text-muted">{new Date(r.client.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-xs font-medium">
                    {r.commissionCents ? `$${(r.commissionCents / 100).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {r.paidAt ? (
                      <span className="text-success">Paid {new Date(r.paidAt).toLocaleDateString()}</span>
                    ) : r.commissionCents ? (
                      <span className="text-warning">Pending</span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
