"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createLender, updateLender } from "@/app/actions/loans"

type LenderDefaults = {
  id?: string
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  programs?: string[]
  minCreditScore?: number | null
  submissionNotes?: string
  active?: boolean
}

export default function LenderForm({ defaults }: { defaults?: LenderDefaults }) {
  const [name, setName] = useState(defaults?.name ?? "")
  const [contactName, setContactName] = useState(defaults?.contactName ?? "")
  const [contactEmail, setContactEmail] = useState(defaults?.contactEmail ?? "")
  const [contactPhone, setContactPhone] = useState(defaults?.contactPhone ?? "")
  const [programs, setPrograms] = useState((defaults?.programs ?? []).join(", "))
  const [minScore, setMinScore] = useState(defaults?.minCreditScore ? String(defaults.minCreditScore) : "")
  const [notes, setNotes] = useState(defaults?.submissionNotes ?? "")
  const [active, setActive] = useState(defaults?.active ?? true)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function submit() {
    if (!name.trim()) { setError("Name is required."); return }
    setError("")

    const programList = programs.split(",").map(p => p.trim()).filter(Boolean)
    const scoreNum = minScore ? parseInt(minScore, 10) : undefined

    startTransition(async () => {
      if (defaults?.id) {
        const res = await updateLender(defaults.id, {
          name,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          programs: programList,
          minCreditScore: scoreNum ?? null,
          submissionNotes: notes || null,
          active,
        })
        if ("error" in res) { setError(res.error); return }
        router.push("/lenders")
      } else {
        const res = await createLender({
          name,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          programs: programList,
          minCreditScore: scoreNum,
          submissionNotes: notes || undefined,
        })
        if ("error" in res) { setError(res.error); return }
        router.push("/lenders")
      }
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
      <div>
        <label className="block text-xs text-muted mb-1">Lender name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className={field} placeholder="First National Bank" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">Contact name</label>
          <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className={field} placeholder="Jane Smith" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Contact phone</label>
          <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={field} placeholder="(555) 000-0000" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Contact email</label>
          <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={field} placeholder="loans@bank.com" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Programs (comma-separated)</label>
        <input type="text" value={programs} onChange={e => setPrograms(e.target.value)} className={field} placeholder="FHA, VA, CONV, SBA" />
        <p className="text-xs text-muted mt-1">e.g. FHA, VA, CONV, JUMBO, SBA, PERSONAL</p>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Minimum credit score</label>
        <input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} className={field} placeholder="620" />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Submission notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={field + " resize-none"} placeholder="Preferred submission method, required forms, turnaround time…" />
      </div>

      {defaults?.id && (
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
          Active
        </label>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={pending}
          className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : defaults?.id ? "Save changes" : "Add Lender"}
        </button>
        <a href="/lenders" className="px-5 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
