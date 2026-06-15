"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createVendor, updateVendor } from "@/app/actions/tradelines"

type Defaults = {
  id?: string
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  payoutTerms?: string
  active?: boolean
}

export default function VendorForm({ defaults }: { defaults?: Defaults }) {
  const [name, setName] = useState(defaults?.name ?? "")
  const [contactName, setContactName] = useState(defaults?.contactName ?? "")
  const [contactEmail, setContactEmail] = useState(defaults?.contactEmail ?? "")
  const [contactPhone, setContactPhone] = useState(defaults?.contactPhone ?? "")
  const [payoutTerms, setPayoutTerms] = useState(defaults?.payoutTerms ?? "")
  const [active, setActive] = useState(defaults?.active ?? true)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    if (!name.trim()) { setError("Vendor name is required."); return }
    setError("")

    startTransition(async () => {
      if (defaults?.id) {
        const res = await updateVendor(defaults.id, {
          name: name.trim(),
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          payoutTerms: payoutTerms || null,
          active,
        })
        if ("error" in res) { setError(res.error); return }
      } else {
        const res = await createVendor({
          name: name.trim(),
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          payoutTerms: payoutTerms || undefined,
        })
        if ("error" in res) { setError(res.error); return }
      }
      router.push("/tradelines/vendors")
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Vendor name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={field} placeholder="AU Tradelines Inc." />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Contact name</label>
          <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className={field} placeholder="Jane Smith" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Contact email</label>
          <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={field} placeholder="jane@vendor.com" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Contact phone</label>
          <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={field} placeholder="+1 555-000-0000" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Payout terms</label>
          <input type="text" value={payoutTerms} onChange={e => setPayoutTerms(e.target.value)} className={field} placeholder="Net 30" />
        </div>

        {defaults?.id && (
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              Active (available for new tradelines)
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button onClick={submit} disabled={pending} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : defaults?.id ? "Save changes" : "Add Vendor"}
        </button>
        <a href="/tradelines/vendors" className="px-5 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">Cancel</a>
      </div>
    </div>
  )
}
