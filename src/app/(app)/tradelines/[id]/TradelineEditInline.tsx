"use client"

import { useState, useTransition } from "react"
import { updateTradeline } from "@/app/actions/tradelines"

type Vendor = { id: string; name: string }

type Defaults = {
  vendorId: string
  bank: string
  creditLimitDollars: string
  cardOpenedDate: string
  statementDate: string
  totalAuSpots: string
  costDollars: string
  retailPriceDollars: string
  notes: string
  active: boolean
}

export default function TradelineEditInline({
  tradelineId,
  vendors,
  defaults,
}: {
  tradelineId: string
  vendors: Vendor[]
  defaults: Defaults
}) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState(defaults)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function save() {
    setError("")
    startTransition(async () => {
      const res = await updateTradeline(tradelineId, {
        bank: v.bank,
        creditLimitCents: Math.round(parseFloat(v.creditLimitDollars) * 100),
        cardOpenedDate: new Date(v.cardOpenedDate),
        statementDate: parseInt(v.statementDate, 10),
        totalAuSpots: parseInt(v.totalAuSpots, 10),
        costCents: Math.round(parseFloat(v.costDollars) * 100),
        retailPriceCents: Math.round(parseFloat(v.retailPriceDollars) * 100),
        notes: v.notes || null,
        active: v.active,
      })
      if ("error" in res) { setError(res.error); return }
      setOpen(false)
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 text-left text-sm text-muted hover:text-ink flex items-center justify-between transition-colors"
      >
        <span>Edit tradeline details</span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-secondary-soft">
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1">Vendor</label>
              <select value={v.vendorId} onChange={e => setV(p => ({ ...p, vendorId: e.target.value }))} className={field}>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1">Bank / Card name</label>
              <input type="text" value={v.bank} onChange={e => setV(p => ({ ...p, bank: e.target.value }))} className={field} />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Credit limit ($)</label>
              <input type="number" value={v.creditLimitDollars} onChange={e => setV(p => ({ ...p, creditLimitDollars: e.target.value }))} className={field} />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Card opened date</label>
              <input type="date" value={v.cardOpenedDate} onChange={e => setV(p => ({ ...p, cardOpenedDate: e.target.value }))} className={field} />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Statement close day</label>
              <input type="number" value={v.statementDate} onChange={e => setV(p => ({ ...p, statementDate: e.target.value }))} className={field} min="1" max="31" />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Total AU spots</label>
              <input type="number" value={v.totalAuSpots} onChange={e => setV(p => ({ ...p, totalAuSpots: e.target.value }))} className={field} min="1" />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Our cost ($)</label>
              <input type="number" value={v.costDollars} onChange={e => setV(p => ({ ...p, costDollars: e.target.value }))} className={field} step="0.01" />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Client retail price ($)</label>
              <input type="number" value={v.retailPriceDollars} onChange={e => setV(p => ({ ...p, retailPriceDollars: e.target.value }))} className={field} step="0.01" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1">Notes</label>
              <textarea value={v.notes} onChange={e => setV(p => ({ ...p, notes: e.target.value }))} rows={2} className={field + " resize-none"} />
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={v.active} onChange={e => setV(p => ({ ...p, active: e.target.checked }))} />
                Active (available for new orders)
              </label>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <div className="mt-4 flex gap-3">
            <button onClick={save} disabled={pending} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button onClick={() => { setOpen(false); setV(defaults) }} className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
