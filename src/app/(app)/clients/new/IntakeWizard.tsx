"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/app/actions/clients"

type Agent = { id: string; name: string | null }

type Props = {
  agents: Agent[]
  canAccessPII: boolean
}

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
  ssn: string
  dob: string
  modules: string[]
  status: string
  assignedAgentId: string
  notes: string
}

const INITIAL: FormState = {
  firstName: "", lastName: "", email: "", phone: "",
  addressLine1: "", addressLine2: "", city: "", state: "", zip: "",
  ssn: "", dob: "",
  modules: ["CREDIT_REPAIR"],
  status: "LEAD",
  assignedAgentId: "",
  notes: "",
}

const MODULES = [
  { value: "CREDIT_REPAIR", label: "Credit Repair", desc: "3-bureau dispute workflow, letters, FCRA tracking" },
  { value: "LOAN", label: "Loan Processing", desc: "Lender submissions, conditions, funding pipeline" },
  { value: "TRADELINE", label: "Tradelines", desc: "Authorized user spot assignments" },
]

const STATUSES = [
  { value: "LEAD", label: "Lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "CONSULT_SCHEDULED", label: "Consult Scheduled" },
  { value: "SIGNED", label: "Signed" },
  { value: "ACTIVE", label: "Active Client" },
]

function StepDot({ n, current, done }: { n: number; current: number; done: boolean }) {
  const isActive = n === current
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
      ${done ? "bg-success border-success text-white"
             : isActive ? "bg-primary border-primary text-white"
             : "bg-white border-secondary-soft text-muted"}`}>
      {done ? "✓" : n}
    </div>
  )
}

function StepLine({ done }: { done: boolean }) {
  return <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-success" : "bg-secondary-soft"}`} />
}

function Field({
  label, value, onChange, type = "text", placeholder, required, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; autoComplete?: string
}) {
  return (
    <div>
      <label className="block text-sm text-muted mb-1">{label}{required && " *"}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  )
}

export default function IntakeWizard({ agents, canAccessPII }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const totalSteps = canAccessPII ? 5 : 4

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleModule(mod: string) {
    set("modules", form.modules.includes(mod)
      ? form.modules.filter(m => m !== mod)
      : [...form.modules, mod])
  }

  function canAdvance(): boolean {
    if (step === 1) return !!(form.firstName.trim() && form.lastName.trim() && (form.email.trim() || form.phone.trim()))
    return true
  }

  function submit() {
    setError("")
    startTransition(async () => {
      const fd = new FormData()
      fd.append("firstName", form.firstName)
      fd.append("lastName", form.lastName)
      fd.append("email", form.email)
      fd.append("phone", form.phone)
      fd.append("addressLine1", form.addressLine1)
      fd.append("addressLine2", form.addressLine2)
      fd.append("city", form.city)
      fd.append("state", form.state)
      fd.append("zip", form.zip)
      if (canAccessPII) {
        fd.append("ssn", form.ssn)
        fd.append("dob", form.dob)
      }
      fd.append("status", form.status)
      fd.append("assignedAgentId", form.assignedAgentId)
      if (form.modules.includes("CREDIT_REPAIR")) fd.append("mod_cr", "on")
      if (form.modules.includes("LOAN")) fd.append("mod_loan", "on")
      if (form.modules.includes("TRADELINE")) fd.append("mod_tradeline", "on")
      if (form.notes) fd.append("note", form.notes)

      const res = await createClient(undefined, fd)
      if (res?.error) {
        setError(res.error)
      } else {
        router.push("/clients")
      }
    })
  }

  // Step labels
  const stepLabels = ["Basic Info", "Address", ...(canAccessPII ? ["Identity"] : []), "Services", "Review"]

  return (
    <div className="max-w-2xl space-y-8">
      {/* Step indicator */}
      <div className="flex items-center">
        {stepLabels.map((label, i) => {
          const n = i + 1
          const done = n < step
          return (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <StepDot n={n} current={step} done={done} />
                <span className={`text-[10px] font-medium ${n === step ? "text-primary" : done ? "text-success" : "text-muted"}`}>
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && <StepLine done={done} />}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">Contact Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" value={form.firstName} onChange={v => set("firstName", v)} required />
              <Field label="Last name" value={form.lastName} onChange={v => set("lastName", v)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" value={form.email} onChange={v => set("email", v)} type="email" placeholder="client@example.com" />
              <Field label="Phone" value={form.phone} onChange={v => set("phone", v)} type="tel" placeholder="(555) 000-0000" />
            </div>
            <p className="text-xs text-muted bg-secondary-soft/50 rounded-lg px-3 py-2">
              At least one of email or phone is required.
            </p>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">Address</h2>
            <Field label="Street address" value={form.addressLine1} onChange={v => set("addressLine1", v)} placeholder="123 Main St" autoComplete="street-address" />
            <Field label="Apt / Suite / Unit" value={form.addressLine2} onChange={v => set("addressLine2", v)} placeholder="Apt 4B" />
            <div className="grid grid-cols-3 gap-4">
              <Field label="City" value={form.city} onChange={v => set("city", v)} autoComplete="address-level2" />
              <Field label="State" value={form.state} onChange={v => set("state", v)} placeholder="CA" autoComplete="address-level1" />
              <Field label="ZIP" value={form.zip} onChange={v => set("zip", v)} placeholder="90210" autoComplete="postal-code" />
            </div>
            <p className="text-xs text-muted">Address is used on dispute letters — enter the client's current mailing address.</p>
          </div>
        )}

        {/* Step 3: PII (only when canAccessPII) */}
        {canAccessPII && step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">Identity</h2>
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
              <p className="font-semibold mb-1">GLBA Safeguards Notice</p>
              <p>SSN and DOB are encrypted with AES-256-GCM before storage. Only staff with PII access can view this information, and every view is audit-logged per GLBA requirements.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Social Security Number" value={form.ssn} onChange={v => set("ssn", v)} type="password" placeholder="###-##-####" autoComplete="off" />
              <Field label="Date of birth" value={form.dob} onChange={v => set("dob", v)} type="date" />
            </div>
            <p className="text-xs text-muted">Leave blank if not available now — can be added later from the client profile.</p>
          </div>
        )}

        {/* Services step */}
        {step === (canAccessPII ? 4 : 3) && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">Services</h2>

            <div>
              <p className="text-sm text-ink font-medium mb-2">Enroll in modules</p>
              <div className="space-y-2">
                {MODULES.map(m => (
                  <label key={m.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    form.modules.includes(m.value) ? "border-primary bg-primary/5" : "border-secondary-soft hover:border-primary/30"
                  }`}>
                    <input
                      type="checkbox"
                      checked={form.modules.includes(m.value)}
                      onChange={() => toggleModule(m.value)}
                      className="mt-0.5 rounded border-secondary-soft text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="text-sm font-medium text-ink">{m.label}</p>
                      <p className="text-xs text-muted">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Pipeline status</label>
                <select
                  value={form.status}
                  onChange={e => set("status", e.target.value)}
                  className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-muted">Assigned agent</label>
                  <a href="/settings/users" target="_blank" className="text-xs text-primary hover:underline">+ Add agent</a>
                </div>
                <select
                  value={form.assignedAgentId}
                  onChange={e => set("assignedAgentId", e.target.value)}
                  className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Unassigned</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Initial notes</label>
              <textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                rows={3}
                placeholder="Any relevant context about this client…"
                className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
        )}

        {/* Review step */}
        {step === totalSteps && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-widest">Review & Create</h2>

            {error && (
              <p className="text-sm text-danger bg-red-50 rounded-lg px-4 py-3">{error}</p>
            )}

            <div className="space-y-3">
              <div className="rounded-lg border border-secondary-soft p-4">
                <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Contact</p>
                <InfoRow label="Name" value={`${form.firstName} ${form.lastName}`} />
                <InfoRow label="Email" value={form.email} />
                <InfoRow label="Phone" value={form.phone} />
              </div>

              {(form.addressLine1 || form.city) && (
                <div className="rounded-lg border border-secondary-soft p-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Address</p>
                  <InfoRow label="Street" value={[form.addressLine1, form.addressLine2].filter(Boolean).join(", ")} />
                  <InfoRow label="City / State / ZIP" value={[form.city, form.state, form.zip].filter(Boolean).join(" ")} />
                </div>
              )}

              {canAccessPII && (form.ssn || form.dob) && (
                <div className="rounded-lg border border-secondary-soft p-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Identity</p>
                  <InfoRow label="SSN" value={form.ssn ? "●●●–●●–●●●●" : ""} />
                  <InfoRow label="DOB" value={form.dob ? new Date(form.dob).toLocaleDateString("en-US") : ""} />
                </div>
              )}

              <div className="rounded-lg border border-secondary-soft p-4">
                <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Services</p>
                <InfoRow label="Modules" value={form.modules.map(m => MODULES.find(x => x.value === m)?.label ?? m).join(", ") || "None"} />
                <InfoRow label="Status" value={STATUSES.find(s => s.value === form.status)?.label ?? form.status} />
                <InfoRow label="Agent" value={agents.find(a => a.id === form.assignedAgentId)?.name ?? "Unassigned"} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex justify-between">
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="rounded-lg border border-secondary-soft px-5 py-2.5 text-sm text-muted hover:text-ink transition-colors"
            >
              ← Back
            </button>
          )}
          <a href="/clients" className="rounded-lg border border-secondary-soft px-5 py-2.5 text-sm text-muted hover:text-ink transition-colors">
            Cancel
          </a>
        </div>

        {step < totalSteps ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance()}
            className="rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium px-6 py-2.5 transition-colors disabled:opacity-50"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium px-6 py-2.5 transition-colors disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create Client"}
          </button>
        )}
      </div>
    </div>
  )
}
