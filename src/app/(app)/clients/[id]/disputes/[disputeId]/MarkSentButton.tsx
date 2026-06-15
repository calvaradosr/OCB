"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { markDisputeSent } from "@/app/actions/disputes"

export function MarkSentButton({ disputeId }: { disputeId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await markDisputeSent(disputeId)
          router.refresh()
        })
      }
      disabled={isPending}
      className="px-4 py-2 bg-success text-white rounded text-sm font-medium hover:bg-success/90 disabled:opacity-50"
    >
      {isPending ? "Updating…" : "Mark Letters as Sent"}
    </button>
  )
}
