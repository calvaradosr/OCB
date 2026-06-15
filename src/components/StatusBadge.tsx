import { STATUS_LABELS, STATUS_COLORS, type ClientStatus, isValidStatus } from "@/lib/client-utils"

export function StatusBadge({ status }: { status: string }) {
  const s = isValidStatus(status) ? status : ("LEAD" as ClientStatus)
  const { bg, text } = STATUS_COLORS[s]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
      {STATUS_LABELS[s]}
    </span>
  )
}
