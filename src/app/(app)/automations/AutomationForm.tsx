"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AutomationTrigger, AutomationAction } from "@prisma/client"
import { createAutomation, updateAutomation } from "@/app/actions/automations"

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  REPORT_IMPORTED: "Report imported",
  DISPUTE_OUTCOME_DELETED: "Dispute item deleted",
  DISPUTE_OUTCOME_ANY: "Any dispute outcome recorded",
  FCRA_CLOCK_30_DAYS: "FCRA 30-day clock expires",
  FCRA_CLOCK_45_DAYS: "FCRA 45-day clock expires",
  CLIENT_CREATED: "New client created",
  INVOICE_OVERDUE: "Invoice overdue",
}

const ACTION_LABELS: Record<AutomationAction, string> = {
  SEND_EMAIL: "Send email",
  SEND_SMS: "Send SMS",
  CREATE_TASK: "Create task / note",
  CHARGE_PER_DELETE: "Create per-deletion invoice",
  NOTIFY_CLIENT: "Send portal message to client",
}

type Defaults = {
  id?: string
  name?: string
  trigger?: AutomationTrigger
  action?: AutomationAction
  actionSubject?: string
  actionBody?: string
  actionAmountCents?: string
  conditionModule?: string
  active?: boolean
}

export default function AutomationForm({ defaults }: { defaults?: Defaults }) {
  const [name, setName] = useState(defaults?.name ?? "")
  const [trigger, setTrigger] = useState<AutomationTrigger>(defaults?.trigger ?? "CLIENT_CREATED")
  const [action, setAction] = useState<AutomationAction>(defaults?.action ?? "SEND_EMAIL")
  const [subject, setSubject] = useState(defaults?.actionSubject ?? "")
  const [body, setBody] = useState(defaults?.actionBody ?? "")
  const [amountCents, setAmountCents] = useState(defaults?.actionAmountCents ?? "")
  const [conditionModule, setConditionModule] = useState(defaults?.conditionModule ?? "")
  const [active, setActive] = useState(defaults?.active ?? true)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function buildActionConfig(): Record<string, unknown> {
    switch (action) {
      case "SEND_EMAIL": return { subject, html: body, body }
      case "SEND_SMS": return { body }
      case "CREATE_TASK": return { task: body }
      case "CHARGE_PER_DELETE": return { amountCents: parseInt(amountCents, 10) || 0, description: body || "Per-deletion fee" }
      case "NOTIFY_CLIENT": return { body }
      default: return {}
    }
  }

  function submit() {
    if (!name.trim()) { setError("Name is required."); return }
    setError("")

    const conditions = conditionModule ? { module: conditionModule } : undefined

    startTransition(async () => {
      if (defaults?.id) {
        const res = await updateAutomation(defaults.id, {
          name, trigger, action, actionConfig: buildActionConfig(), conditions, active,
        })
        if ("error" in res) { setError(res.error); return }
      } else {
        const res = await createAutomation({
          name, trigger, action, actionConfig: buildActionConfig(), conditions,
        })
        if ("error" in res) { setError(res.error); return }
      }
      router.push("/automations")
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"
  const needsSubject = action === "SEND_EMAIL"
  const needsAmount = action === "CHARGE_PER_DELETE"
  const needsBody = action !== "CHARGE_PER_DELETE"

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-6 space-y-5">
      <div>
        <label className="block text-xs text-muted mb-1">Automation name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className={field} placeholder="Send welcome email on signup" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">When (trigger)</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value as AutomationTrigger)} className={field}>
            {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Then (action)</label>
          <select value={action} onChange={e => setAction(e.target.value as AutomationAction)} className={field}>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Filter by module (optional)</label>
        <select value={conditionModule} onChange={e => setConditionModule(e.target.value)} className={field}>
          <option value="">All clients</option>
          <option value="CREDIT_REPAIR">Credit Repair only</option>
          <option value="LOAN">Loan only</option>
          <option value="TRADELINE">Tradeline only</option>
        </select>
      </div>

      {needsSubject && (
        <div>
          <label className="block text-xs text-muted mb-1">Email subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={field} placeholder="Welcome, {{firstName}}!" />
        </div>
      )}

      {needsBody && (
        <div>
          <label className="block text-xs text-muted mb-1">
            {action === "SEND_EMAIL" ? "Email body (HTML)" : action === "CREATE_TASK" ? "Task description" : "Message body"}
          </label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} className={field + " resize-none"} placeholder="Hi {{firstName}}, …" />
          <p className="text-xs text-muted mt-1">Available variables: {"{{firstName}} {{lastName}} {{email}} {{agentName}}"}</p>
        </div>
      )}

      {needsAmount && (
        <div>
          <label className="block text-xs text-muted mb-1">Amount (cents) *</label>
          <input type="number" value={amountCents} onChange={e => setAmountCents(e.target.value)} className={field} placeholder="9900 = $99" />
        </div>
      )}

      {defaults?.id && (
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          Active
        </label>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button onClick={submit} disabled={pending} className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : defaults?.id ? "Save changes" : "Create automation"}
        </button>
        <a href="/automations" className="px-5 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">Cancel</a>
      </div>
    </div>
  )
}
