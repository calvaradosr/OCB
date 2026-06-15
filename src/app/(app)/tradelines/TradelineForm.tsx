"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createTradeline, updateTradeline } from "@/app/actions/tradelines"

type Vendor = { id: string; name: string }

type Defaults = {
  id?: string
  vendorId?: string
  bank?: string
  creditLimitDollars?: string
  cardOpenedDate?: string   // ISO date string
  statementDate?: string
  totalAuSpots?: string
  costDollars?: string
  retailPriceDollars?: string
  notes?: string
  active?: boolean
}

export default function TradelineForm({
  vendors,
  defaults,
}: {
  vendors: Vendor[]
  defaults?: Defaults
}) {
  const [vendorId, setVendorId] = useState(defaults?.vendorId ?? "")
  const [bank, setBank] = useState(defaults?.bank ?? "")
  const [limitDollars, setLimitDollars] = useState(defaults?.creditLimitDollars ?? "")
  const [openedDate, setOpenedDate] = useState(defaults?.cardOpenedDate ?? "")
  const [stmtDay, setStmtDay] = useState(defaults?.statementDate ?? "")
  const [auSpots, setAuSpots] = useState(defaults?.totalAuSpots ?? "1")
  const [costDollars, setCostDollars] = useState(defaults?.costDollars ?? "")
  const [retailDollars, setRetailDollars] = useState(defaults?.retailPriceDollars ?? "")
  const [notes, setNotes] = useState(defaults?.notes ?? "")
  const [active, setActive] = useState(defaults?.active ?? true)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function submit() {
    if (!vendorId || !bank || !limitDollars || !openedDate || !stmtDay || !costDollars || !retailDollars) {
      setError("Please fill in all required fields."); return
    }
    setError("")

    const payload = {
      vendorId,
      bank,
      creditLimitCents: Math.round(parseFloat(limitDollars) * 100),
      cardOpenedDate: new Date(openedDate),
      statementDate: parseInt(stmtDay, 10),
      totalAuSpots: parseInt(auSpots, 10) || 1,
      costCents: Math.round(parseFloat(costDollars) * 100),
      retailPriceCents: Math.round(parseFloat(retailDollars) * 100),
      notes: notes || undefined,
    }

    startTransition(async () => {
      if (defaults?.id) {
        const res = await updateTradeline(defaults.id, { ...payload, active })
        if ("error" in res) { setError(res.error); return }
      } else {
        const res = await createTradeline(payload)
        if ("error" in res) { setError(res.error); return }
      }
      router.push("/tradelines")
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Vendor *</label>
          <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={field}>
            <option value="">Select vendor…</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Bank / Card name *</label>
          <input type="text" value={bank} onChange={e => setBank(e.target.value)} className={field} placeholder="Chase Sapphire" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Credit limit ($) *</label>
          <input type="number" value={limitDollars} onChange={e => setLimitDollars(e.target.value)} className={field} placeholder="10000" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Card opened date *</label>
          <input type="date" value={openedDate} onChange={e => setOpenedDate(e.target.value)} className={field} />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Statement close day *</label>
          <input type="number" value={stmtDay} onChange={e => setStmtDay(e.target.value)} className={field} placeholder="15" min="1" max="31" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Total AU spots</label>
          <input type="number" value={auSpots} onChange={e => setAuSpots(e.target.value)} className={field} min="1" max="10" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Our cost ($) *</label>
          <input type="number" value={costDollars} onChange={e => setCostDollars(e.target.value)} className={field} placeholder="150" step="0.01" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Client retail price ($) *</label>
          <input type="number" value={retailDollars} onChange={e => setRetailDollars(e.target.value)} className={field} placeholder="300" step="0.01" />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={field + " resize-none"} placeholder="Internal notes…" />
        </div>

        {defaults?.id && (
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              Active (available for new orders)
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button onClick={submit} disabled={pending} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : defaults?.id ? "Save changes" : "Add Tradeline"}
        </button>
        <a href="/tradelines" className="px-5 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">Cancel</a>
      </div>
    </div>
  )
}
