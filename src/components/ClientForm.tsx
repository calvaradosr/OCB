"use client"
import { useState } from "react"
import { useFormState, useFormStatus } from "react-dom"
import {
  CLIENT_STATUSES,
  STATUS_LABELS,
} from "@/lib/client-utils"

type Agent = { id: string; name: string }

type PrevAddr = {
  addressLine1: string; addressLine2: string; city: string; state: string; zip: string
  fromYear: string; toYear: string
}

const EMPTY_PREV_ADDR: PrevAddr = {
  addressLine1: "", addressLine2: "", city: "", state: "", zip: "", fromYear: "", toYear: "",
}

type DefaultValues = {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  phoneType?: string
  altPhone?: string
  altPhoneType?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
  previousAddresses?: PrevAddr[]
  employerName?: string
  occupation?: string
  monthlyIncome?: string
  leadSource?: string
  tags?: string
  coAppFirstName?: string
  coAppLastName?: string
  coAppEmail?: string
  coAppPhone?: string
  status?: string
  assignedAgentId?: string | null
  modules?: string[]
}

const PHONE_TYPES = [
  { value: "MOBILE", label: "Mobile" },
  { value: "HOME", label: "Home" },
  { value: "WORK", label: "Work" },
]

const LEAD_SOURCES = [
  { value: "", label: "—" },
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "AFFILIATE", label: "Affiliate" },
  { value: "GOOGLE", label: "Google" },
  { value: "SOCIAL", label: "Social Media" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "OTHER", label: "Other" },
]

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

  const [prevAddresses, setPrevAddresses] = useState<PrevAddr[]>(
    defaultValues.previousAddresses ?? []
  )
  function addPrevAddress() {
    setPrevAddresses(a => [...a, { ...EMPTY_PREV_ADDR }])
  }
  function setPrevAddress(i: number, key: keyof PrevAddr, val: string) {
    setPrevAddresses(a => a.map((row, idx) => idx === i ? { ...row, [key]: val } : row))
  }
  function removePrevAddress(i: number) {
    setPrevAddresses(a => a.filter((_, idx) => idx !== i))
  }

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
        <div className="grid grid-cols-3 gap-4">
          <SelectField label="Phone type" name="phoneType" defaultValue={defaultValues.phoneType ?? "MOBILE"} options={PHONE_TYPES} />
          <Field label="Alt. phone" name="altPhone" type="tel" defaultValue={defaultValues.altPhone ?? ""} />
          <SelectField label="Alt. phone type" name="altPhoneType" defaultValue={defaultValues.altPhoneType ?? "HOME"} options={PHONE_TYPES} />
        </div>
        <Field label="Address" name="addressLine1" defaultValue={defaultValues.addressLine1 ?? ""} />
        <Field label="Apt / Suite" name="addressLine2" defaultValue={defaultValues.addressLine2 ?? ""} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="City" name="city" defaultValue={defaultValues.city ?? ""} />
          <Field label="State" name="state" defaultValue={defaultValues.state ?? ""} />
          <Field label="ZIP" name="zip" defaultValue={defaultValues.zip ?? ""} />
        </div>

        {/* Previous addresses — serialized to a hidden input for the action */}
        <input type="hidden" name="previousAddresses" value={JSON.stringify(prevAddresses)} />
        <div className="pt-2 border-t border-secondary-soft">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-ink">Previous addresses</p>
            <button type="button" onClick={addPrevAddress} className="text-xs text-primary hover:underline">+ Add previous address</button>
          </div>
          {prevAddresses.length === 0 && (
            <p className="text-xs text-muted">Optional — adds prior addresses bureaus may have on file.</p>
          )}
          <div className="space-y-3">
            {prevAddresses.map((a, i) => (
              <div key={i} className="rounded-lg border border-secondary-soft p-3 space-y-2 bg-secondary-soft/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Address {i + 1}</span>
                  <button type="button" onClick={() => removePrevAddress(i)} className="text-xs text-muted hover:text-danger">Remove</button>
                </div>
                <ControlledField label="Street address" value={a.addressLine1} onChange={v => setPrevAddress(i, "addressLine1", v)} placeholder="123 Old St" />
                <div className="grid grid-cols-3 gap-3">
                  <ControlledField label="City" value={a.city} onChange={v => setPrevAddress(i, "city", v)} />
                  <ControlledField label="State" value={a.state} onChange={v => setPrevAddress(i, "state", v)} placeholder="CA" />
                  <ControlledField label="ZIP" value={a.zip} onChange={v => setPrevAddress(i, "zip", v)} placeholder="90210" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ControlledField label="From year" value={a.fromYear} onChange={v => setPrevAddress(i, "fromYear", v)} placeholder="2018" />
                  <ControlledField label="To year" value={a.toYear} onChange={v => setPrevAddress(i, "toYear", v)} placeholder="2021" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Background */}
      <section className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-widest text-muted">
          Background
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employer" name="employerName" defaultValue={defaultValues.employerName ?? ""} placeholder="Acme Corp" />
          <Field label="Occupation" name="occupation" defaultValue={defaultValues.occupation ?? ""} placeholder="Driver" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monthly income ($)" name="monthlyIncome" defaultValue={defaultValues.monthlyIncome ?? ""} placeholder="4500" />
          <SelectField label="Lead source" name="leadSource" defaultValue={defaultValues.leadSource ?? ""} options={LEAD_SOURCES} />
        </div>
        <Field label="Tags (comma-separated)" name="tags" defaultValue={defaultValues.tags ?? ""} placeholder="VIP, Spanish, Refi-2026" />
      </section>

      {/* Co-applicant / spouse */}
      <section className="bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-widest text-muted">
          Co-applicant / spouse
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" name="coAppFirstName" defaultValue={defaultValues.coAppFirstName ?? ""} />
          <Field label="Last name" name="coAppLastName" defaultValue={defaultValues.coAppLastName ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" name="coAppEmail" type="email" defaultValue={defaultValues.coAppEmail ?? ""} placeholder="co@example.com" />
          <Field label="Phone" name="coAppPhone" type="tel" defaultValue={defaultValues.coAppPhone ?? ""} placeholder="(555) 000-0000" />
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
          <p className="text-sm font-medium text-ink pt-2">Co-applicant identity</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Co-applicant SSN" name="coAppSsn" type="password" placeholder="###-##-####" autoComplete="off" />
            <Field label="Co-applicant DOB" name="coAppDob" type="date" />
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

function ControlledField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-muted mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string
  name: string
  defaultValue?: string
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-sm text-muted mb-1">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
