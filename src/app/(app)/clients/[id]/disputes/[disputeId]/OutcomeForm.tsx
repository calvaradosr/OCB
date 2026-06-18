"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { recordOutcome } from "@/app/actions/disputes"

type Outcome = "DELETED" | "REPAIRED" | "VERIFIED" | "NO_RESPONSE"

const OUTCOMES: { value: Outcome; label: string; color: string }[] = [
  { value: "DELETED",     label: "Deleted",     color: "text-success" },
  { value: "REPAIRED",    label: "Repaired",    color: "text-primary" },
  { value: "VERIFIED",    label: "Verified",    color: "text-danger" },
  { value: "NO_RESPONSE", label: "No Response", color: "text-muted" },
]

export function OutcomeForm({
  disputeItemId,
  currentOutcome,
}: {
  disputeItemId: string
  currentOutcome: string
}) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | "">(
    currentOutcome !== "PENDING" ? (currentOutcome as Outcome) : ""
  )
  const [responseDate, setResponseDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [responseNote, setResponseNote] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Inline select while PENDING — clicking opens the expanded form
  if (!open && currentOutcome === "PENDING") {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded border border-dashed border-muted/40 text-muted hover:border-primary hover:text-primary transition-colors"
      >
        + Record outcome
      </button>
    )
  }

  // Already has an outcome — show badge + edit button
  if (!open && currentOutcome !== "PENDING") {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted hover:text-ink transition-colors underline underline-offset-2"
      >
        Edit
      </button>
    )
  }

  function handleSave() {
    if (!outcome) return
    startTransition(async () => {
      await recordOutcome(disputeItemId, outcome, responseDate || undefined, responseNote || undefined)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="mt-2 p-3 bg-canvas border border-secondary-soft rounded-lg space-y-3 text-sm min-w-[280px]">
      <p className="text-xs font-semibold text-ink uppercase tracking-wide">Record Bureau Response</p>

      {/* Outcome buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        {OUTCOMES.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setOutcome(opt.value)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors
              ${outcome === opt.value
                ? "border-primary bg-primary text-white"
                : "border-secondary-soft bg-white hover:border-primary/40"
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Response date */}
      <div>
        <label className="block text-xs text-muted mb-0.5">Date bureau responded</label>
        <input
          type="date"
          value={responseDate}
          onChange={e => setResponseDate(e.target.value)}
          className="w-full text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Response note */}
      <div>
        <label className="block text-xs text-muted mb-0.5">Bureau response note (optional)</label>
        <input
          type="text"
          value={responseNote}
          onChange={e => setResponseNote(e.target.value)}
          placeholder='e.g. "Creditor verified account" or "Item deleted per dispute"'
          className="w-full text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={isPending || !outcome}
          className="px-4 py-1.5 bg-primary text-white text-xs rounded font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 border border-secondary-soft text-xs rounded text-muted hover:bg-secondary-soft/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
