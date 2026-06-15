"use client"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CLIENT_STATUSES, STATUS_LABELS } from "@/lib/client-utils"
import { updateClientStatus } from "@/app/actions/clients"

export function StatusChanger({
  clientId,
  currentStatus,
}: {
  clientId: string
  currentStatus: string
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    startTransition(async () => {
      await updateClientStatus(clientId, next as typeof CLIENT_STATUSES[number])
      router.refresh()
    })
  }

  return (
    <div className="mt-4 pt-4 border-t border-secondary-soft flex items-center gap-2">
      <span className="text-sm text-muted">Move to:</span>
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-lg border border-secondary-soft px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        {CLIENT_STATUSES.map(s => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {isPending && <span className="text-xs text-muted">Saving…</span>}
    </div>
  )
}
