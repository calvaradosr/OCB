"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateAffiliate } from "@/app/actions/affiliates"

export default function EditAffiliateForm({
  affiliateId,
  defaults,
}: {
  affiliateId: string
  defaults: { commissionPct: number; active: boolean }
}) {
  const [commission, setCommission] = useState(String(defaults.commissionPct))
  const [active, setActive] = useState(defaults.active)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    setError("")
    startTransition(async () => {
      const res = await updateAffiliate(affiliateId, {
        commissionPct: parseInt(commission, 10),
        active,
      })
      if ("error" in res) { setError(res.error); return }
      router.push("/affiliates")
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
      <div>
        <label className="block text-xs text-muted mb-1">Commission %</label>
        <input type="number" value={commission} onChange={e => setCommission(e.target.value)} className={field} min="0" max="100" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
        Active
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={pending} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <a href="/affiliates" className="px-5 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">Cancel</a>
      </div>
    </div>
  )
}
