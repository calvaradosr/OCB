"use client"

import { useState, useTransition } from "react"
import { createTradelineOrder } from "@/app/actions/tradelines"
import { formatLimit, cardAgeYears } from "@/lib/tradeline-utils"

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

export default function AssignTradelineModal({
  clientId,
  tradelines,
  onClose,
}: {
  clientId: string
  tradelines: AvailableTradeline[]
  onClose: () => void
}) {
  const [step, setStep] = useState<"select" | "info">("select")
  const [selected, setSelected] = useState<AvailableTradeline | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [address, setAddress] = useState("")
  const [dob, setDob] = useState("")
  const [ssn, setSsn] = useState("")
  const [removalDate, setRemovalDate] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function selectTradeline(tl: AvailableTradeline) {
    setSelected(tl)
    setStep("info")
  }

  function submit() {
    if (!selected) return
    if (!firstName || !lastName || !address) {
      setError("First name, last name, and address are required."); return
    }
    setError("")

    startTransition(async () => {
      const res = await createTradelineOrder({
        clientId,
        tradelineId: selected.id,
        auFirstName: firstName.trim(),
        auLastName: lastName.trim(),
        auAddress: address.trim(),
        auDob: dob || undefined,
        auSsn: ssn || undefined,
        removalDate: removalDate ? new Date(removalDate) : undefined,
      })
      if ("error" in res) { setError(res.error); return }
      onClose()
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
        <div className="px-6 py-5 border-b border-secondary-soft flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            {step === "select" ? "Select Tradeline" : `AU Info — ${selected?.bank}`}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none">×</button>
        </div>

        {step === "select" && (
          <div className="p-6">
            {tradelines.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No tradelines with available spots. Add more inventory first.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {tradelines.map(tl => (
                  <button
                    key={tl.id}
                    onClick={() => selectTradeline(tl)}
                    className="w-full text-left p-3 rounded-xl border border-secondary-soft hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink">{tl.bank}</p>
                        <p className="text-xs text-muted">{tl.vendor.name} · {cardAgeYears(tl.cardOpenedDate)}y old · statement day {tl.statementDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">{formatLimit(tl.retailPriceCents)}</p>
                        <p className="text-xs text-muted">{tl.availableAuSpots}/{tl.totalAuSpots} spots</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "info" && selected && (
          <div className="p-6 space-y-4">
            <div className="text-xs bg-secondary-soft/50 rounded-lg p-3 text-muted">
              Adding AU to <strong className="text-ink">{selected.bank}</strong> ({formatLimit(selected.creditLimitCents)} limit) for <strong className="text-ink">{formatLimit(selected.retailPriceCents)}</strong>.
              AU info will be sent to vendor after payment is confirmed.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">First name *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Last name *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={field} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted mb-1">Address *</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={field} placeholder="123 Main St, City, ST 00000" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Date of birth</label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">SSN (last 4 or full)</label>
                <input
                  type="password"
                  value={ssn}
                  onChange={e => setSsn(e.target.value)}
                  className={field}
                  placeholder="Encrypted at rest"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Planned removal date</label>
                <input type="date" value={removalDate} onChange={e => setRemovalDate(e.target.value)} className={field} />
              </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <p className="text-xs text-muted">DOB and SSN are encrypted with AES-256-GCM before storage. Only staff with tradelines:read can view this record.</p>
          </div>
        )}

        <div className="px-6 py-4 border-t border-secondary-soft flex justify-between">
          {step === "info" ? (
            <>
              <button onClick={() => setStep("select")} className="text-sm text-muted hover:text-ink">← Back</button>
              <button
                onClick={submit}
                disabled={pending}
                className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {pending ? "Creating order…" : "Create Order"}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="text-sm text-muted hover:text-ink">Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}
