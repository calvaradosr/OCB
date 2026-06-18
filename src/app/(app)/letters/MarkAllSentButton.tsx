"use client"

import { useState, useTransition } from "react"
import { markAllLettersSent } from "@/app/actions/letters"

export function MarkAllSentButton({ count }: { count: number }) {
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`Mark all ${count} unsent letters as sent?`)) return
    startTransition(async () => {
      await markAllLettersSent()
      setDone(true)
    })
  }

  if (done) return <span className="text-xs text-success font-medium">All marked sent!</span>

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="px-3 py-1.5 rounded-lg border border-warning/40 bg-warning/5 text-warning text-xs font-medium hover:bg-warning/10 transition-colors disabled:opacity-60"
    >
      {pending ? "Marking…" : `Mark all ${count} sent`}
    </button>
  )
}
