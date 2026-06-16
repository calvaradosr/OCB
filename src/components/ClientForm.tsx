"use client"
import { useFormState, useFormStatus } from "react-dom"
import {
  CLIENT_STATUSES,
  STATUS_LABELS,
  DOCUMENT_CATEGORIES,
} from "@/lib/client-utils"

type Agent = { id: string; name: string }

type DefaultValues = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
  status?: string
  assignedAgentId?: string | null
  modules?: string[]
}

type Action = (
  prevState: { error?: string } | undefined,
  formData: FormData
) => Promise<{ error?: string } | undefined>

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-medium px-6 py-2.5 transition-colors"
    >
      {pending ? "Saving…" : label}
    </button>
  )
}

export function ClientForm({
  action,
  defaultValues = {},
  agents,
  canAccessPII,
  submitLabel = "Save",
}: {
  action: Action
  defaultValues?: DefaultValues
  agents: Agent[]
  canAccessPII: boolean
  submitLabel?: string
}) {
  const [state, formAction] = useFormState(action, undefined)
  const mods = defaultValues.modules ?? ["CREDIT_REPAIR"]

  return (
    <form action={formAction} className="space-y-8">
      {state?.error && (
        <p className="text-sm text-danger bg-red-50 rounded-lg px-4 py-3">{state.error}</p>
      )}

      {/* Basic info */}
      <section className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
        <h3 className="font-semibold text-ink text-sm uppercase tracking-widest text-muted">
          Contact Info
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name *" name="firstName" defaultValue={defaultValues.firstName} required />
          <Field label="Last name *" name="lastName" defaultValue={defaultValues.lastName} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" name="email" type="email" defaultValue={defaultValues.email ?? ""} />
          <Field label="Phone" name="phone" type="tel" defaultValue={defaultValues.phone ?? ""} />
        </div>
        <Field label="Address" name="addressLine1" defaultValue={defaultValues.addressLine1 ?? ""} />
        <Field label="Apt / Suite" name="addressLine2" defaultValue={defaultValues.addressLine2 ?? ""} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" name="city" defaultValue={defaultValues.city ?? ""} />
          <Field label="State" name="state" defaultValue={defaultValues.state ?? ""} />
          <Field label="ZIP" name="zip" defaultValue={defaultValues.zip ?? ""} />
        </div>
      </section>

      {/* PII — only for authorized roles */}
      {canAccessPII && (
        <section className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-widest text-muted">
            Identity (PII — encrypted at rest)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="SSN"
              name="ssn"
              type="password"
              placeholder="###-##-####"
              autoComplete="off"
            />
            <Field label="Date of birth" name="dob" type="date" />
          </div>
          <p className="text-xs text-muted">
            Leave blank to keep existing value. All PII is encrypted with AES-256-GCM before storage.
          </p>
        </section>
      )}

      {/* Pipeline */}
      <section className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-widest text-muted">
          Pipeline
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Status</label>
            <select
              name="status"
              defaultValue={defaultValues.status ?? "LEAD"}
              className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CLIENT_STATUSES.map(s => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted">Assigned agent</label>
              <a href="/settings/users" className="text-xs text-primary hover:underline">+ Add agent</a>
            </div>
            <select
              name="assignedAgentId"
              defaultValue={defaultValues.assignedAgentId ?? ""}
              className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Unassigned</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted mb-2">Modules</p>
          <div className="flex gap-4">
            {(
              [
                ["mod_cr", "Credit Repair", "CREDIT_REPAIR"],
                ["mod_loan", "Loan Processing", "LOAN"],
                ["mod_tradeline", "Tradelines", "TRADELINE"],
              ] as const
            ).map(([name, label, mod]) => (
              <label key={name} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={mods.includes(mod)}
                  className="rounded border-secondary-soft text-primary focus:ring-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <SubmitButton label={submitLabel} />
        <a
          href="/clients"
          className="rounded-lg border border-secondary-soft px-6 py-2.5 text-sm text-muted hover:text-ink transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  autoComplete,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div>
      <label className="block text-sm text-muted mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}
