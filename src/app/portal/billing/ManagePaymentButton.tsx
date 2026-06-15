"use client"

import { useState, useTransition } from "react"
import { createBillingPortalSession } from "@/app/actions/billing"

export default function ManagePaymentButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function open() {
    setError("")
    startTransition(async () => {
      const res = await createBillingPortalSession(
        clientId,
        typeof window !== "undefined" ? window.location.href : "/portal/billing"
      )
      if ("error" in res) { setError(res.error); return }
      window.location.href = res.url
    })
  }

  return (
    <div>
      <button
        onClick={open}
        disabled={pending}
        className="text-xs px-3 py-1.5 rounded border border-secondary-soft text-muted hover:text-ink hover:border-secondary disabled:opacity-50 transition-colors"
      >
        {pending ? "Loading…" : "Manage payment method"}
      </button>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
