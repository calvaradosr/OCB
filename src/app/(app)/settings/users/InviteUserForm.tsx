"use client"

import { useState, useTransition } from "react"
import { createStaffUser } from "@/app/actions/users"
import type { Role } from "@/lib/rbac"

const STAFF_ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "AGENT", label: "Agent" },
  { value: "LOAN_PROCESSOR", label: "Loan Processor" },
]

export default function InviteUserForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>("AGENT")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name || !email || !password) { setError("All fields required."); return }
    setError("")
    startTransition(async () => {
      const res = await createStaffUser({ name, email, password, role })
      if ("error" in res) { setError(res.error); return }
      onDone()
    })
  }

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Full name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={field} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={field} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Temporary password *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={field} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Role *</label>
          <select value={role} onChange={e => setRole(e.target.value as Role)} className={field}>
            {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button onClick={submit} disabled={pending} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {pending ? "Creating…" : "Create user"}
        </button>
        <button onClick={onDone} className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
