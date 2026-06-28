"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toggleItemFlag } from "@/app/actions/reports"

export function FlagToggle({ itemId, flagged }: { itemId: string; flagged: boolean }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await toggleItemFlag(itemId)
          router.refresh()
        })
      }
      disabled={isPending}
      title={flagged ? "Remove flag" : "Flag for blocking"}
      className={`text-sm transition-opacity disabled:opacity-50 ${flagged ? "opacity-100" : "opacity-30 hover:opacity-70"}`}
    >
      🚩
    </button>
  )
}
