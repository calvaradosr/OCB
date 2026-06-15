"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createAffiliate } from "@/app/actions/affiliates"

export default function AffiliateForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [commission, setCommission] = useState("10")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    if (!name || !email || !password) { setError("All fields required."); return }
    setError("")
    startTransition(async () => {
      const res = await createAffiliate({
        name: name.trim(),
        email: email.trim(),
        password,
        commissionPct: parseInt(commission, 10) || 10,
      })
      if ("error" in res) { setError(res.error); return }
      router.push("/affiliates")
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Full name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={field} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Email (login) *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={field} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Temporary password *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={field} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Commission %</label>
          <input type="number" value={commission} onChange={e => setCommission(e.target.value)} className={field} min="0" max="100" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={pending} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {pending ? "Creating…" : "Create Affiliate"}
        </button>
        <a href="/affiliates" className="px-5 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">Cancel</a>
      </div>
    </div>
  )
}
