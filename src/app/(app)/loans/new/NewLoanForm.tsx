"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createLoanFile } from "@/app/actions/loans"
import { LoanType } from "@prisma/client"
import { LOAN_TYPE_LABELS } from "@/lib/loan-utils"

const LOAN_TYPES = Object.entries(LOAN_TYPE_LABELS) as [LoanType, string][]

export default function NewLoanForm({
  clients,
  lenders,
  processors,
  defaultClientId,
}: {
  clients: { id: string; firstName: string; lastName: string; status: string }[]
  lenders: { id: string; name: string }[]
  processors: { id: string; name: string; role: string }[]
  defaultClientId?: string
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? "")
  const [type, setType] = useState<LoanType>("PERSONAL")
  const [lenderId, setLenderId] = useState("")
  const [processorId, setProcessorId] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [rate, setRate] = useState("")
  const [termMonths, setTermMonths] = useState("")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function submit() {
    if (!clientId) { setError("Select a client."); return }
    setError("")

    startTransition(async () => {
      const res = await createLoanFile({
        clientId,
        type,
        lenderId: lenderId || undefined,
        processorId: processorId || undefined,
        amountRequestedCents: amountDollars ? Math.round(parseFloat(amountDollars) * 100) : undefined,
        interestRate: rate ? parseFloat(rate) : undefined,
        termMonths: termMonths ? parseInt(termMonths, 10) : undefined,
        notes: notes || undefined,
      })

      if ("error" in res) { setError(res.error); return }
      router.push(`/loans/${res.id}`)
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Client *</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className={field}>
            <option value="">Select client…</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.lastName}, {c.firstName} ({c.status})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Loan type *</label>
          <select value={type} onChange={e => setType(e.target.value as LoanType)} className={field}>
            {LOAN_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Lender</label>
          <select value={lenderId} onChange={e => setLenderId(e.target.value)} className={field}>
            <option value="">— None yet —</option>
            {lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Processor</label>
          <select value={processorId} onChange={e => setProcessorId(e.target.value)} className={field}>
            <option value="">— Unassigned —</option>
            {processors.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.role.replace("_"," ")})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Amount requested ($)</label>
          <input
            type="number"
            value={amountDollars}
            onChange={e => setAmountDollars(e.target.value)}
            placeholder="50000"
            className={field}
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Interest rate (%)</label>
          <input
            type="number"
            value={rate}
            onChange={e => setRate(e.target.value)}
            placeholder="6.99"
            step="0.01"
            className={field}
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Term (months)</label>
          <input
            type="number"
            value={termMonths}
            onChange={e => setTermMonths(e.target.value)}
            placeholder="60"
            className={field}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className={field + " resize-none"}
            placeholder="Internal notes…"
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={pending}
          className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {pending ? "Creating…" : "Create Loan File"}
        </button>
        <a href="/loans" className="px-5 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
