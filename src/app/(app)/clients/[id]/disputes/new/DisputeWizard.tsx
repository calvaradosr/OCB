"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { previewDisputeLetters, createDispute, type DisputeWizardData } from "@/app/actions/disputes"
import type { GeneratedLetter } from "@/lib/letters/generate"
import {
  DISPUTE_STRATEGIES,
  STRATEGY_TEMPLATES,
  TEMPLATE_LABELS,
  ITEM_TYPE_LABELS,
  BUREAU_LABELS,
  type ItemTypeValue,
  type BureauValue,
} from "@/lib/report-utils"

export type ItemForWizard = {
  id: string
  creditorName: string
  accountNumberMasked: string | null
  type: string
  onExperian: boolean
  onEquifax: boolean
  onTransunion: boolean
  flagged: boolean
}

type Step = 1 | 2 | 3 | 4

function bureausForItem(item: ItemForWizard): BureauValue[] {
  const b: BureauValue[] = []
  if (item.onExperian) b.push("EXPERIAN")
  if (item.onEquifax) b.push("EQUIFAX")
  if (item.onTransunion) b.push("TRANSUNION")
  return b
}

const LETTER_TARGET_LABELS: Record<string, string> = {
  BUREAU: "Bureau Letter",
  CFPB: "CFPB Complaint",
  FTC: "FTC Report",
  STATE_AG: "State AG Letter",
}

export default function DisputeWizard({
  clientId,
  items,
}: {
  clientId: string
  items: ItemForWizard[]
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  // Step 1: selected item IDs and which bureaus per item
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.filter(it => it.flagged).map(it => it.id))
  )
  const [selectedBureaus, setSelectedBureaus] = useState<Record<string, Set<BureauValue>>>(
    () =>
      Object.fromEntries(
        items.map(it => [it.id, new Set(bureausForItem(it))])
      )
  )

  // Step 2: strategy + reasons + template + escalations
  const [strategy, setStrategy] = useState("INACCURATE")
  const [defaultReason, setDefaultReason] = useState("Information is inaccurate and cannot be verified")
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({})
  const [templateId, setTemplateId] = useState("initial-dispute-bureau")
  const [includeCFPB, setIncludeCFPB] = useState(false)
  const [includeFTC, setIncludeFTC] = useState(false)
  const [includeStateAG, setIncludeStateAG] = useState(false)

  // Step 3: previewed letters
  const [letters, setLetters] = useState<GeneratedLetter[]>([])
  const [previewTab, setPreviewTab] = useState(0)

  const selectedItems = items.filter(it => selectedIds.has(it.id))

  function toggleItem(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleBureau(itemId: string, bureau: BureauValue) {
    setSelectedBureaus(prev => {
      const current = new Set(prev[itemId] ?? [])
      if (current.has(bureau)) current.delete(bureau)
      else current.add(bureau)
      return { ...prev, [itemId]: current }
    })
  }

  function buildData(): DisputeWizardData {
    return {
      clientId,
      strategy,
      templateId,
      includeCFPB,
      includeFTC,
      includeStateAG,
      selections: selectedItems.map(it => ({
        itemId: it.id,
        creditorName: it.creditorName,
        accountNumberMasked: it.accountNumberMasked,
        type: it.type,
        bureaus: Array.from(selectedBureaus[it.id] ?? bureausForItem(it)),
        reason: itemReasons[it.id] ?? defaultReason,
      })),
    }
  }

  function goToStep2() {
    if (!selectedIds.size) { setError("Select at least one item."); return }
    setError("")
    setStep(2)
  }

  function goToStep3() {
    if (!defaultReason.trim()) { setError("Enter a dispute reason."); return }
    setError("")
    startTransition(async () => {
      const result = await previewDisputeLetters(buildData())
      setLetters(result)
      setPreviewTab(0)
      setStep(3)
    })
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await createDispute(buildData())
      if ("error" in result) { setError(result.error); return }
      router.push(`/clients/${clientId}/disputes/${result.disputeId}`)
      router.refresh()
    })
  }

  const availableTemplates = STRATEGY_TEMPLATES[strategy] ?? ["initial-dispute-bureau"]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <ol className="flex gap-2 text-sm">
        {([1, 2, 3, 4] as Step[]).map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${step === s ? "bg-primary text-white" : step > s ? "bg-success text-white" : "bg-secondary-soft text-muted"}`}>
              {step > s ? "✓" : s}
            </span>
            <span className={step === s ? "text-primary font-medium" : "text-muted"}>
              {["Select Items", "Strategy", "Preview", "Confirm"][i]}
            </span>
            {i < 3 && <span className="text-secondary-soft">›</span>}
          </li>
        ))}
      </ol>

      {/* Step 1 — Select items */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Select items to dispute</h2>
              <p className="text-sm text-muted">Flagged items are pre-selected. Choose which bureaus to dispute at for each item.</p>
            </div>
            {items.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setSelectedIds(new Set(items.map(it => it.id)))}
                  className="px-3 py-1.5 rounded-lg border border-secondary-soft text-muted hover:text-ink hover:border-primary/30 transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedIds(new Set(items.filter(it => it.flagged).map(it => it.id)))}
                  className="px-3 py-1.5 rounded-lg border border-secondary-soft text-warning hover:border-warning/50 transition-colors"
                >
                  Flagged only
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 rounded-lg border border-secondary-soft text-muted hover:text-ink transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-sm text-muted p-8 border border-dashed border-secondary-soft rounded-lg text-center">
              No report items found. Import a credit report first.
            </div>
          ) : (
            <div className="divide-y divide-secondary-soft border border-secondary-soft rounded-lg">
              {items.map(it => {
                const isSelected = selectedIds.has(it.id)
                const bureaus = bureausForItem(it)
                return (
                  <div key={it.id} className={`flex items-start gap-3 p-3 ${isSelected ? "bg-primary/5" : ""}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(it.id)}
                      className="mt-1 accent-primary w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-ink">{it.creditorName}</span>
                        {it.accountNumberMasked && (
                          <span className="text-xs text-muted">{it.accountNumberMasked}</span>
                        )}
                        <span className="text-xs bg-secondary-soft px-2 py-0.5 rounded">
                          {ITEM_TYPE_LABELS[it.type as ItemTypeValue] ?? it.type}
                        </span>
                        {it.flagged && <span className="text-xs text-danger font-medium">🚩 Flagged</span>}
                      </div>
                      {isSelected && bureaus.length > 0 && (
                        <div className="flex gap-3 mt-2">
                          {(["EXPERIAN", "EQUIFAX", "TRANSUNION"] as BureauValue[]).map(b => (
                            bureaus.includes(b) ? (
                              <label key={b} className="flex items-center gap-1 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedBureaus[it.id]?.has(b) ?? false}
                                  onChange={() => toggleBureau(it.id, b)}
                                  className="accent-primary"
                                />
                                {BUREAU_LABELS[b]}
                              </label>
                            ) : null
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-muted">{selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected</p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            onClick={goToStep2}
            disabled={!items.length}
            className="px-6 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2 — Strategy + reasons */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-ink">Dispute strategy &amp; reasons</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Strategy</label>
              <select
                value={strategy}
                onChange={e => {
                  setStrategy(e.target.value)
                  const tpls = STRATEGY_TEMPLATES[e.target.value]
                  if (tpls?.length) setTemplateId(tpls[0])
                }}
                className="w-full border border-secondary-soft rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {DISPUTE_STRATEGIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Letter template</label>
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className="w-full border border-secondary-soft rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {availableTemplates.map(t => (
                  <option key={t} value={t}>{TEMPLATE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Default dispute reason</label>
            <input
              type="text"
              value={defaultReason}
              onChange={e => setDefaultReason(e.target.value)}
              className="w-full border border-secondary-soft rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Reason applied to all items"
            />
          </div>

          <div className="border border-secondary-soft rounded-lg divide-y divide-secondary-soft">
            <p className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wide bg-secondary-soft/30">
              Per-item reasons (optional overrides)
            </p>
            {selectedItems.map(it => (
              <div key={it.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm text-ink w-48 truncate">{it.creditorName}</span>
                <input
                  type="text"
                  value={itemReasons[it.id] ?? ""}
                  onChange={e => setItemReasons(prev => ({ ...prev, [it.id]: e.target.value }))}
                  placeholder={defaultReason}
                  className="flex-1 text-sm border border-secondary-soft rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Regulatory escalations</p>
            {[
              { key: "cfpb", label: "Include CFPB complaint", state: includeCFPB, set: setIncludeCFPB },
              { key: "ftc", label: "Include FTC identity theft report", state: includeFTC, set: setIncludeFTC },
              { key: "ag", label: "Include State AG complaint letter", state: includeStateAG, set: setIncludeStateAG },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opt.state}
                  onChange={e => opt.set(e.target.checked)}
                  className="accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 border border-secondary-soft rounded text-sm text-muted hover:bg-secondary-soft/30">
              Back
            </button>
            <button
              onClick={goToStep3}
              disabled={isPending}
              className="px-6 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Generating preview…" : "Preview Letters"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Preview letters */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Letter preview</h2>
          <p className="text-sm text-muted">
            {letters.length} letter{letters.length !== 1 ? "s" : ""} will be created.
            Review each one before confirming.
          </p>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-secondary-soft overflow-x-auto">
            {letters.map((l, i) => (
              <button
                key={i}
                onClick={() => setPreviewTab(i)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors
                  ${previewTab === i ? "border-primary text-primary font-medium" : "border-transparent text-muted hover:text-ink"}`}
              >
                {LETTER_TARGET_LABELS[l.target] ?? l.target}
                {l.bureau ? ` — ${l.bureau.charAt(0) + l.bureau.slice(1).toLowerCase()}` : ""}
              </button>
            ))}
          </div>

          {letters[previewTab] && (
            <pre className="bg-secondary-soft/20 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {letters[previewTab].body}
            </pre>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 border border-secondary-soft rounded text-sm text-muted hover:bg-secondary-soft/30">
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-6 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90"
            >
              Continue to Confirm
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Confirm */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Confirm dispute</h2>
          <div className="bg-secondary-soft/20 rounded-lg p-4 text-sm space-y-2">
            <p><span className="text-muted">Strategy:</span> <strong>{DISPUTE_STRATEGIES.find(s => s.value === strategy)?.label ?? strategy}</strong></p>
            <p><span className="text-muted">Items:</span> <strong>{selectedItems.length}</strong></p>
            <p><span className="text-muted">Letters to generate:</span> <strong>{letters.length}</strong></p>
            {(includeCFPB || includeFTC || includeStateAG) && (
              <p className="text-warning text-xs">Includes regulatory escalation letters (CFPB / FTC / State AG)</p>
            )}
          </div>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
            Letters will be saved as drafts. You must click &quot;Mark as Sent&quot; on the dispute detail page once letters are actually mailed to start the FCRA 30-day clock.
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="px-4 py-2 border border-secondary-soft rounded text-sm text-muted hover:bg-secondary-soft/30">
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="px-6 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Creating dispute…" : "Create Dispute"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
