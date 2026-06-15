"use client"

import { useState, useTransition } from "react"
import { cancelSubscription, createSubscription } from "@/app/actions/billing"
import { useRouter } from "next/navigation"

type Sub = {
  id: string
  stripeSubscriptionId: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export default function SubscriptionPanel({
  clientId,
  stripeCustomerId,
  subscriptions,
  canWrite,
}: {
  clientId: string
  stripeCustomerId: string | null
  subscriptions: Sub[]
  canWrite: boolean
}) {
  const activeSub = subscriptions.find(s => s.status === "active" || s.status === "trialing")
  const [showCreate, setShowCreate] = useState(false)
  const [priceId, setPriceId] = useState("")
  const [setupFee, setSetupFee] = useState("19900")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function cancel(subId: string, stripeSubId: string) {
    setError("")
    startTransition(async () => {
      const res = await cancelSubscription(stripeSubId, clientId)
      if ("error" in res) { setError(res.error); return }
      router.refresh()
    })
  }

  function create() {
    if (!priceId.trim()) { setError("Enter a Stripe Price ID."); return }
    setError("")
    startTransition(async () => {
      const res = await createSubscription(clientId, {
        priceId,
        setupFeeCents: parseInt(setupFee, 10) || 0,
      })
      if ("error" in res) { setError(res.error); return }
      setShowCreate(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-lg border border-secondary-soft p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Subscription</h3>
        {canWrite && !activeSub && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            + Start Subscription
          </button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {activeSub ? (
        <div className="flex items-center justify-between">
          <div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                activeSub.status === "active" ? "bg-green-50 text-success" : "bg-secondary-soft text-muted"
              }`}
            >
              {activeSub.cancelAtPeriodEnd ? "Canceling" : activeSub.status}
            </span>
            {activeSub.currentPeriodEnd && (
              <span className="text-xs text-muted ml-2">
                Next billing: {new Date(activeSub.currentPeriodEnd).toLocaleDateString()}
              </span>
            )}
          </div>
          {canWrite && !activeSub.cancelAtPeriodEnd && (
            <button
              onClick={() => cancel(activeSub.id, activeSub.stripeSubscriptionId)}
              disabled={pending}
              className="text-xs text-danger hover:underline disabled:opacity-50"
            >
              Cancel at period end
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">No active subscription.</p>
      )}

      {showCreate && (
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-secondary-soft">
          <div>
            <label className="block text-xs text-muted mb-1">Stripe Price ID</label>
            <input
              type="text"
              value={priceId}
              onChange={e => setPriceId(e.target.value)}
              placeholder="price_..."
              className="w-full rounded border border-secondary-soft px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Setup fee (cents)</label>
            <input
              type="number"
              value={setupFee}
              onChange={e => setSetupFee(e.target.value)}
              className="w-full rounded border border-secondary-soft px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={create}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {pending ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setError("") }}
              className="text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
