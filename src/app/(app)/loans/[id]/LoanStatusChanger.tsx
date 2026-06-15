"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateLoanStatus } from "@/app/actions/loans"
import { LoanStatus } from "@prisma/client"
import { LOAN_STATUS_LABELS } from "@/lib/loan-utils"

export default function LoanStatusChanger({
  loanFileId,
  currentStatus,
  allowedNext,
}: {
  loanFileId: string
  currentStatus: LoanStatus
  allowedNext: LoanStatus[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const router = useRouter()

  function move(to: LoanStatus) {
    setError("")
    startTransition(async () => {
      const res = await updateLoanStatus(loanFileId, to)
      if ("error" in res) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Move to:</p>
      <div className="flex flex-wrap gap-2">
        {allowedNext.map(status => (
          <button
            key={status}
            onClick={() => move(status)}
            disabled={pending}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              status === "FUNDED"
                ? "bg-success text-white hover:bg-success/80"
                : status === "DECLINED" || status === "WITHDRAWN"
                ? "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20"
                : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
            }`}
          >
            {LOAN_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
