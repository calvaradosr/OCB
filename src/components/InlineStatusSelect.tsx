"use client"

import { useTransition } from "react"
import { CLIENT_STATUSES, STATUS_LABELS } from "@/lib/client-utils"
import { updateClientStatus } from "@/app/actions/clients"

export function InlineStatusSelect({
  clientId,
  currentStatus,
}: {
  clientId: string
  currentStatus: string
}) {
  const [pending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const next = e.target.value as typeof CLIENT_STATUSES[number]
    startTransition(async () => {
      await updateClientStatus(clientId, next)
    })
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={pending}
      onClick={e => e.stopPropagation()}
      className="rounded-md border border-secondary-soft px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 bg-white cursor-pointer"
    >
      {CLIENT_STATUSES.map(s => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  )
}
