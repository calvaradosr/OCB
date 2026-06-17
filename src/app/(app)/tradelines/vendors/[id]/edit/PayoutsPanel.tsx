"use client"

import { useState, useTransition } from "react"
import { markVendorPaid, markVendorPaidBulk } from "@/app/actions/tradelines"

type UnpaidOrder = {
  id: string
  vendorCostCents: number | null
  createdAt: Date
  client: { firstName: string; lastName: string }
  tradeline: { bank: string }
}

function formatAmount(cents: number | null) {
  if (!cents) return "—"
  return `$${(cents / 100).toLocaleString()}`
}

export function PayoutsPanel({
  vendorId,
  unpaidOrders,
}: {
  vendorId: string
  unpaidOrders: UnpaidOrder[]
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const visible = unpaidOrders.filter(o => !dismissed.has(o.id))
  const totalCents = visible.reduce((s, o) => s + (o.vendorCostCents ?? 0), 0)

  function payOne(orderId: string) {
    setError("")
    startTransition(async () => {
      const res = await markVendorPaid(orderId)
      if ("error" in res) setError(res.error)
      else setDismissed(prev => new Set([...prev, orderId]))
    })
  }

  function payAll() {
    setError("")
    startTransition(async () => {
      const res = await markVendorPaidBulk(vendorId)
      if ("error" in res) setError(res.error)
      else setDismissed(new Set(unpaidOrders.map(o => o.id)))
    })
  }

  if (unpaidOrders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-secondary-soft p-6 text-center">
        <p className="text-sm font-semibold text-success">All caught up</p>
        <p className="text-xs text-muted mt-1">No outstanding vendor payments.</p>
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-secondary-soft p-6 text-center">
        <p className="text-sm font-semibold text-success">All marked paid</p>
        <p className="text-xs text-muted mt-1">Refresh to confirm changes.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-secondary-soft flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Outstanding Payouts</h2>
          <p className="text-xs text-muted mt-0.5">
            {visible.length} order{visible.length !== 1 ? "s" : ""} · total{" "}
            <span className="font-semibold text-ink">{formatAmount(totalCents)}</span>
          </p>
        </div>
        <button
          onClick={payAll}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-lg bg-success text-white font-medium hover:bg-success/80 transition-colors disabled:opacity-50"
        >
          Mark All Paid
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-secondary-soft/50">
          <tr>
            <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Client</th>
            <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Tradeline</th>
            <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Date</th>
            <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Cost</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-soft">
          {visible.map(o => (
            <tr key={o.id} className="hover:bg-secondary-soft/30">
              <td className="px-5 py-3 text-ink">
                {o.client.firstName} {o.client.lastName}
              </td>
              <td className="px-5 py-3 text-muted">{o.tradeline.bank}</td>
              <td className="px-5 py-3 text-xs text-muted">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="px-5 py-3 font-medium text-ink">
                {formatAmount(o.vendorCostCents)}
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => payOne(o.id)}
                  disabled={pending}
                  className="text-xs px-2.5 py-1 rounded-lg border border-success/40 text-success hover:bg-success/5 transition-colors disabled:opacity-50"
                >
                  Mark Paid
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="px-5 py-3 text-xs text-danger">{error}</p>}
    </div>
  )
}
