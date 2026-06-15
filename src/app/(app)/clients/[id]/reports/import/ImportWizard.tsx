"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { importReport, type ImportedItem } from "@/app/actions/reports"
import { ITEM_TYPES, ITEM_TYPE_LABELS, AUTO_FLAG_TYPES } from "@/lib/report-utils"

type LocalItem = ImportedItem & { localId: string }

type Step = "method" | "items" | "scores" | "confirm"

const EMPTY_ITEM = (): LocalItem => ({
  localId: Math.random().toString(36).slice(2),
  creditorName: "",
  accountNumberMasked: "",
  type: "COLLECTION",
  onExperian: true,
  onEquifax: true,
  onTransunion: true,
  balance: "",
  dateOpened: "",
  flagged: true,
})

export default function ImportWizard({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("method")
  const [items, setItems] = useState<LocalItem[]>([EMPTY_ITEM()])
  const [scoreExperian, setScoreExperian] = useState("")
  const [scoreEquifax, setScoreEquifax] = useState("")
  const [scoreTransunion, setScoreTransunion] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  function updateItem(localId: string, patch: Partial<LocalItem>) {
    setItems(prev =>
      prev.map(it => {
        if (it.localId !== localId) return it
        const merged = { ...it, ...patch }
        if (patch.type) merged.flagged = AUTO_FLAG_TYPES.has(patch.type)
        return merged
      })
    )
  }

  function removeItem(localId: string) {
    setItems(prev => prev.filter(it => it.localId !== localId))
  }

  function handleSubmit() {
    setError("")
    startTransition(async () => {
      const valid = items.filter(it => it.creditorName.trim())
      if (!valid.length) { setError("Add at least one item with a creditor name."); return }
      const result = await importReport(clientId, {
        source: "MANUAL_ENTRY",
        scoreExperian,
        scoreEquifax,
        scoreTransunion,
        items: valid,
      })
      if ("error" in result) { setError(result.error); return }
      router.push(`/clients/${clientId}/reports/${result.reportId}`)
      router.refresh()
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <ol className="flex gap-2 text-sm">
        {(["method", "items", "scores", "confirm"] as Step[]).map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${step === s ? "bg-primary text-white" : "bg-secondary-soft text-muted"}`}>
              {i + 1}
            </span>
            <span className={step === s ? "text-primary font-medium" : "text-muted"}>
              {s === "method" ? "Source" : s === "items" ? "Items" : s === "scores" ? "Scores" : "Confirm"}
            </span>
            {i < 3 && <span className="text-secondary-soft">›</span>}
          </li>
        ))}
      </ol>

      {/* Step 1 — Method */}
      {step === "method" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Choose import method</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "manual", title: "Manual Entry", desc: "Enter items by hand. Best for transcribing a physical report." },
              { key: "csv", title: "CSV Upload", desc: "Upload a structured CSV file. Format available below." },
              { key: "api", title: "Partner API", desc: "SmartCredit / IdentityIQ integration. Coming in a future update." },
            ].map(opt => (
              <button
                key={opt.key}
                disabled={opt.key === "api"}
                onClick={() => { if (opt.key !== "api") setStep("items") }}
                className={`border-2 rounded-lg p-4 text-left transition-colors
                  ${opt.key === "api" ? "opacity-40 cursor-not-allowed border-secondary-soft" :
                    "border-secondary-soft hover:border-primary cursor-pointer"}`}
              >
                <p className="font-medium text-ink">{opt.title}</p>
                <p className="text-xs text-muted mt-1">{opt.desc}</p>
                {opt.key === "api" && <span className="text-xs text-warning mt-2 block">Coming soon</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Items */}
      {step === "items" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Enter report items</h2>
          <p className="text-sm text-muted">Add each account, collection, or inquiry from the credit report. Items will be auto-flagged based on type.</p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-soft text-xs text-muted uppercase tracking-wide">
                  <th className="py-2 px-2 text-left w-48">Creditor</th>
                  <th className="py-2 px-2 text-left w-28">Account #</th>
                  <th className="py-2 px-2 text-left w-32">Type</th>
                  <th className="py-2 px-2 text-center">EXP</th>
                  <th className="py-2 px-2 text-center">EQ</th>
                  <th className="py-2 px-2 text-center">TU</th>
                  <th className="py-2 px-2 text-left w-24">Balance</th>
                  <th className="py-2 px-2 text-left w-28">Opened</th>
                  <th className="py-2 px-2 text-center">Flag</th>
                  <th className="py-2 px-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-soft">
                {items.map(it => (
                  <tr key={it.localId} className={it.flagged ? "bg-danger/5" : ""}>
                    <td className="py-1 px-2">
                      <input
                        value={it.creditorName}
                        onChange={e => updateItem(it.localId, { creditorName: e.target.value })}
                        placeholder="e.g. Portfolio Recovery"
                        className="w-full text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        value={it.accountNumberMasked}
                        onChange={e => updateItem(it.localId, { accountNumberMasked: e.target.value })}
                        placeholder="****1234"
                        className="w-full text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <select
                        value={it.type}
                        onChange={e => updateItem(it.localId, { type: e.target.value })}
                        className="w-full text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {ITEM_TYPES.map(t => (
                          <option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>
                    {(["onExperian", "onEquifax", "onTransunion"] as const).map(bureau => (
                      <td key={bureau} className="py-1 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={it[bureau]}
                          onChange={e => updateItem(it.localId, { [bureau]: e.target.checked })}
                          className="accent-primary w-4 h-4"
                        />
                      </td>
                    ))}
                    <td className="py-1 px-2">
                      <input
                        value={it.balance}
                        onChange={e => updateItem(it.localId, { balance: e.target.value })}
                        placeholder="0.00"
                        type="number"
                        min="0"
                        className="w-full text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input
                        value={it.dateOpened}
                        onChange={e => updateItem(it.localId, { dateOpened: e.target.value })}
                        type="date"
                        className="w-full text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className="py-1 px-2 text-center">
                      <button
                        onClick={() => updateItem(it.localId, { flagged: !it.flagged })}
                        className={`text-base transition-opacity ${it.flagged ? "opacity-100" : "opacity-30 hover:opacity-70"}`}
                        title={it.flagged ? "Remove flag" : "Flag this item"}
                      >
                        🚩
                      </button>
                    </td>
                    <td className="py-1 px-2">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(it.localId)} className="text-danger hover:text-danger/70 text-sm font-bold">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setItems(prev => [...prev, EMPTY_ITEM()])}
            className="text-sm text-primary hover:underline"
          >
            + Add row
          </button>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep("method")} className="px-4 py-2 border border-secondary-soft rounded text-sm text-muted hover:bg-secondary-soft/30">
              Back
            </button>
            <button
              onClick={() => {
                const filled = items.filter(it => it.creditorName.trim())
                if (!filled.length) { setError("Add at least one creditor name."); return }
                setError("")
                setStep("scores")
              }}
              className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
            >
              Continue
            </button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}

      {/* Step 3 — Scores */}
      {step === "scores" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Bureau scores (optional)</h2>
          <p className="text-sm text-muted">Enter the credit scores from this report. Leave blank if not available.</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Experian", state: scoreExperian, set: setScoreExperian },
              { label: "Equifax", state: scoreEquifax, set: setScoreEquifax },
              { label: "TransUnion", state: scoreTransunion, set: setScoreTransunion },
            ].map(({ label, state, set }) => (
              <div key={label}>
                <label className="block text-sm font-medium text-ink mb-1">{label}</label>
                <input
                  type="number"
                  min="300"
                  max="850"
                  value={state}
                  onChange={e => set(e.target.value)}
                  placeholder="300–850"
                  className="w-full border border-secondary-soft rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep("items")} className="px-4 py-2 border border-secondary-soft rounded text-sm text-muted hover:bg-secondary-soft/30">
              Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Confirm */}
      {step === "confirm" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Review and import</h2>
          <div className="bg-secondary-soft/20 rounded-lg p-4 text-sm space-y-2">
            <p><span className="text-muted">Items to import:</span> <strong>{items.filter(it => it.creditorName.trim()).length}</strong></p>
            <p><span className="text-muted">Flagged items:</span> <strong className="text-danger">{items.filter(it => it.creditorName.trim() && it.flagged).length}</strong></p>
            {(scoreExperian || scoreEquifax || scoreTransunion) && (
              <p><span className="text-muted">Scores:</span>{" "}
                {scoreExperian && <span>Exp <strong>{scoreExperian}</strong></span>}{" "}
                {scoreEquifax && <span>Eq <strong>{scoreEquifax}</strong></span>}{" "}
                {scoreTransunion && <span>TU <strong>{scoreTransunion}</strong></span>}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep("scores")} className="px-4 py-2 border border-secondary-soft rounded text-sm text-muted hover:bg-secondary-soft/30">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-6 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Import Report"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
