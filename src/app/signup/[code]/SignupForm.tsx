"use client"

import { useState, useTransition } from "react"
import { publicLeadSignup } from "@/app/actions/public"
import { useRouter } from "next/navigation"

type Props = {
  affiliateCode: string
  affiliateName: string | null
  orgName: string
}

export default function SignupForm({ affiliateCode, affiliateName, orgName }: Props) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" })
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    startTransition(async () => {
      const res = await publicLeadSignup({ affiliateCode, ...form })
      if ("error" in res) {
        setError(res.error)
      } else {
        router.push(`/signup/${affiliateCode}/thank-you`)
      }
    })
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">✦</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">{orgName}</h1>
          {affiliateName && (
            <p className="text-sm text-muted mt-1">Referred by <span className="font-medium text-ink">{affiliateName}</span></p>
          )}
          <p className="text-sm text-muted mt-2">Start your credit repair journey today.</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-secondary-soft p-8 shadow-sm space-y-4">
          {error && (
            <p className="text-sm text-danger bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">First name *</label>
                <input
                  required
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Jane"
                  className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Last name *</label>
                <input
                  required
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Smith"
                  className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Phone number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 000-0000"
                className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {pending ? "Submitting…" : "Get Started →"}
            </button>
          </form>

          {/* CROA-compliant disclosure */}
          <div className="pt-2 border-t border-secondary-soft">
            <p className="text-[11px] text-muted leading-relaxed">
              By submitting this form you agree to be contacted about credit repair services.
              Credit repair services are not guaranteed to improve your credit score. You have the right
              to cancel within 3 business days of signing your service agreement. You are not charged
              until after services have been performed on your behalf.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
