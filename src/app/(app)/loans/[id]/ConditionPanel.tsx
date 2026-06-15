"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { addCondition, updateConditionStatus } from "@/app/actions/loans"

type Condition = { id: string; description: string; status: string; clearedAt: string | null }

export default function ConditionPanel({
  loanFileId,
  conditions,
  canWrite,
}: {
  loanFileId: string
  conditions: Condition[]
  canWrite: boolean
}) {
  const [newDesc, setNewDesc] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function add() {
    if (!newDesc.trim()) return
    setError("")
    startTransition(async () => {
      const res = await addCondition(loanFileId, newDesc.trim())
      if ("error" in res) { setError(res.error); return }
      setNewDesc("")
      router.refresh()
    })
  }

  function toggle(id: string, current: string) {
    const next = current === "OPEN" ? "CLEARED" : "OPEN"
    startTransition(async () => {
      await updateConditionStatus(id, next as "CLEARED" | "OPEN")
      router.refresh()
    })
  }

  const open = conditions.filter(c => c.status === "OPEN")
  const closed = conditions.filter(c => c.status !== "OPEN")

  return (
    <div className="space-y-3">
      {conditions.length === 0 && (
        <p className="text-xs text-muted">No conditions.</p>
      )}

      {open.map(c => (
        <div key={c.id} className="flex items-start gap-2">
          <button
            onClick={() => canWrite && toggle(c.id, c.status)}
            disabled={pending || !canWrite}
            className="mt-0.5 h-4 w-4 rounded border-2 border-warning shrink-0 hover:bg-warning/10 transition-colors"
            title="Mark cleared"
          />
          <span className="text-sm text-ink">{c.description}</span>
        </div>
      ))}

      {closed.map(c => (
        <div key={c.id} className="flex items-start gap-2 opacity-50">
          <div className="mt-0.5 h-4 w-4 rounded bg-success border-2 border-success flex items-center justify-center shrink-0">
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm line-through text-muted">{c.description}</span>
        </div>
      ))}

      {error && <p className="text-xs text-danger">{error}</p>}

      {canWrite && (
        <div className="flex gap-2 pt-2 border-t border-secondary-soft">
          <input
            type="text"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="Add condition…"
            className="flex-1 rounded border border-secondary-soft px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={add}
            disabled={pending || !newDesc.trim()}
            className="px-3 py-1.5 rounded bg-primary text-white text-xs hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
