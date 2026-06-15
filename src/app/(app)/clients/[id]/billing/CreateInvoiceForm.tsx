"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createInvoice } from "@/app/actions/billing"

export default function CreateInvoiceForm({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function submit() {
    const cents = Math.round(parseFloat(amountDollars) * 100)
    if (!description.trim() || isNaN(cents) || cents <= 0) {
      setError("Enter a description and valid amount.")
      return
    }
    setError("")
    startTransition(async () => {
      const res = await createInvoice(clientId, { amountCents: cents, description })
      if ("error" in res) { setError(res.error); return }
      setOpen(false)
      setDescription("")
      setAmountDollars("")
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark transition-colors"
      >
        + Invoice
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="rounded border border-secondary-soft px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary w-40"
      />
      <input
        type="number"
        placeholder="Amount ($)"
        value={amountDollars}
        onChange={e => setAmountDollars(e.target.value)}
        className="rounded border border-secondary-soft px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary w-24"
        step="0.01"
        min="0"
      />
      {error && <span className="text-xs text-danger">{error}</span>}
      <button
        onClick={submit}
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => { setOpen(false); setError("") }}
        className="text-xs text-muted hover:text-ink"
      >
        Cancel
      </button>
    </div>
  )
}
