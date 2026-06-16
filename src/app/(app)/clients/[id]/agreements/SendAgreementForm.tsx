"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { sendAgreement } from "@/app/actions/agreements"
import { AgreementType } from "@prisma/client"

const AGREEMENT_TYPES: { value: AgreementType; label: string }[] = [
  { value: "CLIENT_AGREEMENT", label: "Client Service Agreement" },
  { value: "CANCELLATION_NOTICE", label: "3-Day Cancellation Notice (CROA)" },
  { value: "POWER_OF_ATTORNEY", label: "Limited Power of Attorney" },
]

export default function SendAgreementForm({
  clientId,
  clientName,
  clientAddress,
  agentName,
}: {
  clientId: string
  clientName: string
  clientAddress: string
  agentName: string
}) {
  const [type, setType] = useState<AgreementType>("CLIENT_AGREEMENT")
  const [setupFee, setSetupFee] = useState("199.00")
  const [monthlyFee, setMonthlyFee] = useState("99.00")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  function send() {
    setError("")
    setSuccess("")
    startTransition(async () => {
      const res = await sendAgreement(clientId, type, {
        clientName,
        clientAddress,
        agentName,
        companyName: "One Consulting Business",
        startDate: new Date().toLocaleDateString(),
        setupFeeCents: Math.round(parseFloat(setupFee) * 100),
        monthlyFeeCents: Math.round(parseFloat(monthlyFee) * 100),
      })
      if ("error" in res) { setError(res.error); return }
      setSuccess("Agreement sent to client portal.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-muted mb-1">Agreement type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as AgreementType)}
            className="w-full rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {AGREEMENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {type === "CLIENT_AGREEMENT" && (
          <>
            <div>
              <label className="block text-xs text-muted mb-1">Setup fee ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={setupFee}
                  onChange={e => setSetupFee(e.target.value)}
                  className="w-full rounded-lg border border-secondary-soft pl-7 pr-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Monthly fee ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyFee}
                  onChange={e => setMonthlyFee(e.target.value)}
                  className="w-full rounded-lg border border-secondary-soft pl-7 pr-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      <button
        onClick={send}
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
      >
        {pending ? "Sending…" : "Send to Client Portal"}
      </button>
    </div>
  )
}
