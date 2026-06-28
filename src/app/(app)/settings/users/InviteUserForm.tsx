"use client"

import { useState, useTransition } from "react"
import { createStaffUser } from "@/app/actions/users"
import type { Role } from "@/lib/rbac"
import { Eye, EyeOff } from "lucide-react"

const STAFF_ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "ADMIN",          label: "Admin",          desc: "Full access including settings" },
  { value: "MANAGER",        label: "Manager",        desc: "All client & billing access" },
  { value: "AGENT",          label: "Agent",          desc: "CRM, blocks & letters" },
  { value: "LOAN_PROCESSOR", label: "Loan Processor", desc: "Loan pipeline only" },
]

export default function InviteUserForm({ onDone }: { onDone: () => void }) {
  const [name, setName]         = useState("")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [role, setRole]         = useState<Role>("AGENT")
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState("")
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) { setError("Full name is required."); return }
    if (!email.trim()) { setError("Email is required."); return }
    if (!password) { setError("An initial password is required."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    setError("")
    startTransition(async () => {
      const res = await createStaffUser({ name: name.trim(), email: email.trim(), password, role })
      if ("error" in res) { setError(res.error); return }
      setSuccess(`${name.trim()} has been added.`)
      setTimeout(onDone, 1200)
    })
  }

  const field = "w-full rounded-lg border border-secondary-soft bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"

  return (
    <div className="space-y-5">
      {success && (
        <div className="flex items-center gap-2 text-sm text-success bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <span>✓</span> {success}
        </div>
      )}

      {/* Name + Email */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-ink mb-1.5">Full name <span className="text-danger">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={field}
            placeholder="Jane Smith"
            disabled={!!success}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink mb-1.5">Email <span className="text-danger">*</span></label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={field}
            placeholder="jane@company.com"
            disabled={!!success}
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-medium text-ink mb-1.5">
          Initial password <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={field + " pr-10"}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            disabled={!!success}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <p className="text-xs text-muted mt-1">The user will use this to sign in. They can change it from settings.</p>
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-medium text-ink mb-2">Role <span className="text-danger">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          {STAFF_ROLES.map(r => (
            <label
              key={r.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                role === r.value
                  ? "border-primary bg-primary/5"
                  : "border-secondary-soft hover:border-primary/30 hover:bg-secondary-soft/30"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="mt-0.5 accent-primary"
                disabled={!!success}
              />
              <div>
                <p className={`text-xs font-semibold ${role === r.value ? "text-primary" : "text-ink"}`}>{r.label}</p>
                <p className="text-[11px] text-muted mt-0.5">{r.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={submit}
          disabled={pending || !!success}
          className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {pending ? "Creating…" : "Create user"}
        </button>
        <button
          onClick={onDone}
          className="px-5 py-2.5 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink hover:border-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
