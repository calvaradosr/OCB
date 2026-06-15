"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { recordOutcome } from "@/app/actions/disputes"

const OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "DELETED", label: "Deleted" },
  { value: "REPAIRED", label: "Repaired" },
  { value: "VERIFIED", label: "Verified" },
  { value: "NO_RESPONSE", label: "No Response" },
] as const

export function OutcomeForm({
  disputeItemId,
  currentOutcome,
}: {
  disputeItemId: string
  currentOutcome: string
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <select
      value={currentOutcome}
      disabled={isPending}
      onChange={e =>
        startTransition(async () => {
          await recordOutcome(
            disputeItemId,
            e.target.value as "DELETED" | "REPAIRED" | "VERIFIED" | "NO_RESPONSE"
          )
          router.refresh()
        })
      }
      className="text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
    >
      {OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
