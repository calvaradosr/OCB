"use client"

import { useState, useTransition } from "react"
import { TradelineOrderStatus } from "@prisma/client"
import { ORDER_STATUS_LABELS } from "@/lib/tradeline-utils"
import { advanceOrderStatus, markVendorPaid } from "@/app/actions/tradelines"

export default function OrderStatusButton({
  orderId,
  currentStatus,
  allowedNext,
  vendorPaidAt,
}: {
  orderId: string
  currentStatus: TradelineOrderStatus
  allowedNext: TradelineOrderStatus[]
  vendorPaidAt: string | null
}) {
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function advance(next: TradelineOrderStatus) {
    setError("")
    startTransition(async () => {
      const res = await advanceOrderStatus(orderId, next)
      if ("error" in res) setError(res.error)
    })
  }

  function payVendor() {
    setError("")
    startTransition(async () => {
      const res = await markVendorPaid(orderId)
      if ("error" in res) setError(res.error)
    })
  }

  if (allowedNext.length === 0 && vendorPaidAt) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {allowedNext.map(next => (
        <button
          key={next}
          onClick={() => advance(next)}
          disabled={pending}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors disabled:opacity-50 ${
            next === "CANCELLED"
              ? "border-danger/40 text-danger hover:bg-danger/5"
              : "border-primary/30 text-primary hover:bg-primary/5"
          }`}
        >
          → {ORDER_STATUS_LABELS[next]}
        </button>
      ))}

      {!vendorPaidAt && currentStatus !== "PENDING_PAYMENT" && currentStatus !== "CANCELLED" && (
        <button
          onClick={payVendor}
          disabled={pending}
          className="text-xs px-2.5 py-1 rounded-lg font-medium border border-warning/40 text-warning hover:bg-warning/5 transition-colors disabled:opacity-50"
        >
          Mark paid
        </button>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
