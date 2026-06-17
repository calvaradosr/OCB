"use client"

import { useState, useTransition } from "react"
import { createOrganization } from "@/app/actions/organization"

export default function NewOrgForm() {
  const [form, setForm] = useState({ name: "", adminName: "", adminEmail: "", adminPassword: "" })
  const [result, setResult] = useState<{ slug?: string; error?: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    startTransition(async () => {
      const res = await createOrganization(form)
      setResult(res)
      if ("slug" in res) setForm({ name: "", adminName: "", adminEmail: "", adminPassword: "" })
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {result?.error && (
        <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
      )}
      {result && "slug" in result && (
        <p className="text-sm text-success bg-green-50 rounded-lg px-3 py-2">
          Organization <span className="font-mono font-semibold">{result.slug}</span> created successfully.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted mb-1">Organization name</label>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Acme Credit Repair"
            className="w-full rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Admin full name</label>
          <input
            required
            value={form.adminName}
            onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))}
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Admin email</label>
          <input
            required
            type="email"
            value={form.adminEmail}
            onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
            placeholder="admin@acme.com"
            className="w-full rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted mb-1">Admin password</label>
          <input
            required
            type="password"
            minLength={8}
            value={form.adminPassword}
            onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
            placeholder="At least 8 characters"
            className="w-full rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Organization"}
      </button>
    </form>
  )
}
