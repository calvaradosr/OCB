"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { markLetterSent } from "@/app/actions/letters"

export default function MarkSentButton({
  letterId,
  isCFPBorFTC,
}: {
  letterId: string
  isCFPBorFTC: boolean
}) {
  const [open, setOpen] = useState(false)
  const [tracking, setTracking] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  const label = isCFPBorFTC ? "Complaint #" : "Tracking # (optional)"

  function confirm() {
    startTransition(async () => {
      const res = await markLetterSent(letterId, tracking.trim() || undefined)
      if (res && "error" in res) { setError(res.error ?? "Unknown error"); return }
      setOpen(false)
      setTracking("")
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-medium"
      >
        Mark sent
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={tracking}
        onChange={e => setTracking(e.target.value)}
        placeholder={label}
        className="text-xs border border-secondary-soft rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        onClick={confirm}
        disabled={pending}
        className="text-xs px-2.5 py-1 rounded-md bg-primary text-white hover:bg-primary-dark font-medium disabled:opacity-50"
      >
        {pending ? "…" : "Confirm"}
      </button>
      <button
        onClick={() => { setOpen(false); setError("") }}
        className="text-xs text-muted hover:text-ink"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
