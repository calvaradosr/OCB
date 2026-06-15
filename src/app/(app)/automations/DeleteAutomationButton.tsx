"use client"

import { useTransition } from "react"
import { deleteAutomation } from "@/app/actions/automations"

export default function DeleteAutomationButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()

  function handle() {
    if (!confirm(`Delete automation "${name}"?`)) return
    startTransition(async () => { await deleteAutomation(id) })
  }

  return (
    <button onClick={handle} disabled={pending} className="text-xs text-danger hover:underline disabled:opacity-50">
      {pending ? "…" : "Delete"}
    </button>
  )
}
