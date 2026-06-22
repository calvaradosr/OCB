"use client"

import { useState, useTransition } from "react"
import { TradelineOrderStatus } from "@prisma/client"
import { ORDER_STATUS_LABELS } from "@/lib/tradeline-utils"
import {
  revealAuPacket,
  advanceOrderStatus,
  markVendorPaid,
} from "@/app/actions/tradelines"

type PacketData = {
  auFirstName: string | null
  auLastName: string | null
  auAddress: string | null
  auDob: string | null
  auSsn: string | null
  tradelineName: string
  vendorName: string
}

function PacketField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-mono text-ink bg-secondary-soft/50 rounded px-2 py-1">
        {value ?? <span className="text-muted italic">Not provided</span>}
      </p>
    </div>
  )
}

export default function AuPacketModal({
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
  const [open, setOpen] = useState(false)
  const [packet, setPacket] = useState<PacketData | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  function openModal() {
    setError("")
    setOpen(true)
    if (!packet) {
      startTransition(async () => {
        const res = await revealAuPacket(orderId)
        if ("error" in res) {
          setError(res.error)
          setOpen(false)
        } else {
          setPacket(res)
        }
      })
    }
  }

  function advance(next: TradelineOrderStatus) {
    setError("")
    startTransition(async () => {
      const res = await advanceOrderStatus(orderId, next)
      if ("error" in res) setError(res.error)
      else setOpen(false)
    })
  }

  function payVendor() {
    setError("")
    startTransition(async () => {
      const res = await markVendorPaid(orderId)
      if ("error" in res) setError(res.error)
    })
  }

  function copyPacket() {
    if (!packet) return
    const text = [
      `Tradeline: ${packet.tradelineName} (${packet.vendorName})`,
      `AU Name: ${packet.auFirstName ?? ""} ${packet.auLastName ?? ""}`.trim(),
      `Address: ${packet.auAddress ?? "Not provided"}`,
      `DOB: ${packet.auDob ?? "Not provided"}`,
      `SSN: ${packet.auSsn ?? "Not provided"}`,
    ].join("\n")
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (allowedNext.length === 0 && vendorPaidAt) return null

  const needsPacketModal = allowedNext.includes("INFO_SENT_TO_VENDOR")

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {allowedNext.map(next => {
        if (next === "INFO_SENT_TO_VENDOR") {
          return (
            <button
              key={next}
              onClick={openModal}
              disabled={pending}
              className="text-xs px-2.5 py-1 rounded-lg font-medium border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              → {ORDER_STATUS_LABELS[next]}
            </button>
          )
        }
        return (
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
        )
      })}

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

      {/* AU Packet Modal */}
      {open && needsPacketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink">AU Info Packet</h2>
                <p className="text-xs text-muted mt-0.5">
                  Review before sending to vendor. This view is audit-logged.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-ink text-lg leading-none"
              >
                ×
              </button>
            </div>

            {pending && !packet ? (
              <p className="text-sm text-muted text-center py-4">Decrypting…</p>
            ) : packet ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <PacketField label="First Name" value={packet.auFirstName} />
                  <PacketField label="Last Name" value={packet.auLastName} />
                  <PacketField label="Date of Birth" value={packet.auDob} />
                  <PacketField label="SSN" value={packet.auSsn} />
                  <div className="col-span-2">
                    <PacketField label="Address" value={packet.auAddress} />
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-xs text-muted mb-2">
                    Tradeline: <span className="text-ink font-medium">{packet.tradelineName}</span>
                    {" · "}Vendor: <span className="text-ink font-medium">{packet.vendorName}</span>
                  </p>
                  <button
                    onClick={copyPacket}
                    className="w-full text-sm py-2 rounded-lg border border-secondary-soft text-muted hover:text-ink hover:border-ink/20 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy Vendor Packet"}
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 text-sm py-2 rounded-lg border border-secondary-soft text-muted hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => advance("INFO_SENT_TO_VENDOR")}
                    disabled={pending}
                    className="flex-1 text-sm py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    Confirm & Mark Sent
                  </button>
                </div>
              </>
            ) : null}

            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
