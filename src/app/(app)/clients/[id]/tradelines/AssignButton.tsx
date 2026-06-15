"use client"

import { useState } from "react"
import AssignTradelineModal from "./AssignTradelineModal"

type AvailableTradeline = {
  id: string
  bank: string
  creditLimitCents: number
  retailPriceCents: number
  costCents: number
  availableAuSpots: number
  totalAuSpots: number
  statementDate: number
  cardOpenedDate: Date
  vendor: { name: string }
}

export default function AssignButton({
  clientId,
  tradelines,
}: {
  clientId: string
  tradelines: AvailableTradeline[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
      >
        + Assign Tradeline
      </button>

      {open && (
        <AssignTradelineModal
          clientId={clientId}
          tradelines={tradelines}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
