"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateLoanFile } from "@/app/actions/loans"

type Defaults = {
  lenderId: string
  processorId: string
  amountApprovedCents: number | null | undefined
  interestRate: number | null
  termMonths: number | null | undefined
  commissionCents: number | null | undefined
  notes: string
}

export default function LoanEditForm({
  loanFileId,
  lenders,
  processors,
  defaults,
}: {
  loanFileId: string
  lenders: { id: string; name: string }[]
  processors: { id: string; name: string }[]
  defaults: Defaults
}) {
  const [lenderId, setLenderId] = useState(defaults.lenderId)
  const [processorId, setProcessorId] = useState(defaults.processorId)
  const [approved, setApproved] = useState(defaults.amountApprovedCents ? String(defaults.amountApprovedCents / 100) : "")
  const [rate, setRate] = useState(defaults.interestRate != null ? String(defaults.interestRate) : "")
  const [term, setTerm] = useState(defaults.termMonths ? String(defaults.termMonths) : "")
  const [commission, setCommission] = useState(defaults.commissionCents ? String(defaults.commissionCents / 100) : "")
  const [notes, setNotes] = useState(defaults.notes)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  function save() {
    setError("")
    setSaved(false)
    startTransition(async () => {
      const res = await updateLoanFile(loanFileId, {
        lenderId: lenderId || null,
        processorId: processorId || null,
        amountApprovedCents: approved ? Math.round(parseFloat(approved) * 100) : null,
        interestRate: rate ? parseFloat(rate) : null,
        termMonths: term ? parseInt(term, 10) : null,
        commissionCents: commission ? Math.round(parseFloat(commission) * 100) : null,
        notes: notes || null,
      })
      if ("error" in res) { setError(res.error); return }
      setSaved(true)
      router.refresh()
    })
  }

  const field = "rounded border border-secondary-soft px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary w-full"

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted mb-1">Lender</label>
        <select value={lenderId} onChange={e => setLenderId(e.target.value)} className={field}>
          <option value="">— None —</option>
          {lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Processor</label>
        <select value={processorId} onChange={e => setProcessorId(e.target.value)} className={field}>
          <option value="">— Unassigned —</option>
          {processors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted mb-1">Approved amount ($)</label>
          <input type="number" value={approved} onChange={e => setApproved(e.target.value)} className={field} placeholder="50000" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Rate (%)</label>
          <input type="number" value={rate} onChange={e => setRate(e.target.value)} className={field} step="0.01" placeholder="6.99" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Term (mo)</label>
          <input type="number" value={term} onChange={e => setTerm(e.target.value)} className={field} placeholder="60" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Commission ($)</label>
          <input type="number" value={commission} onChange={e => setCommission(e.target.value)} className={field} placeholder="500" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={field + " resize-none"} />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && <p className="text-xs text-success">Saved.</p>}

      <button
        onClick={save}
        disabled={pending}
        className="w-full py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  )
}
