"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateLetterTracking } from "@/app/actions/letters"

export default function TrackingEditor({
  letterId,
  current,
  label,
}: {
  letterId: string
  current: string | null
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current ?? "")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function save() {
    if (!value.trim()) return
    startTransition(async () => {
      await updateLetterTracking(letterId, value.trim())
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted hover:text-ink truncate max-w-[120px] text-left"
        title={current ?? `Add ${label}`}
      >
        {current ?? <span className="italic">Add {label}</span>}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
        autoFocus
        className="text-xs border border-secondary-soft rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        onClick={save}
        disabled={pending}
        className="text-xs text-primary hover:text-primary-dark font-medium disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
    </div>
  )
}
