"use client"

import { useTransition, useState } from "react"
import { useRouter } from "next/navigation"
import { markWorkPerformed, chargeInvoice } from "@/app/actions/billing"

export default function InvoiceActions({
  invoiceId,
  status,
  workPerformedAt,
}: {
  invoiceId: string
  status: string
  workPerformedAt: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  if (status === "PAID" || status === "VOID") return null

  function run(action: () => Promise<{ ok: true } | { error: string }>) {
    setError("")
    startTransition(async () => {
      const res = await action()
      if ("error" in res) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      {!workPerformedAt && (
        <button
          onClick={() => run(() => markWorkPerformed(invoiceId))}
          disabled={pending}
          className="text-xs px-2.5 py-1 rounded border border-secondary-soft text-muted hover:text-ink hover:border-secondary transition-colors disabled:opacity-50"
        >
          Mark performed
        </button>
      )}

      {workPerformedAt && status !== "PAID" && (
        <button
          onClick={() => run(() => chargeInvoice(invoiceId))}
          disabled={pending}
          className="text-xs px-2.5 py-1 rounded bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          Charge
        </button>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
