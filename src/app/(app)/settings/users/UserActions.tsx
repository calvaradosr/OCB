"use client"

import { useState, useTransition } from "react"
import { updateStaffUser, resetUserPassword } from "@/app/actions/users"
import type { Role } from "@/lib/rbac"

const STAFF_ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "AGENT", label: "Agent" },
  { value: "LOAN_PROCESSOR", label: "Loan Processor" },
]

export function RoleSelect({ userId, current }: { userId: string; current: Role }) {
  const [pending, startTransition] = useTransition()

  function change(role: Role) {
    startTransition(async () => { await updateStaffUser(userId, { role }) })
  }

  return (
    <select
      value={current}
      onChange={e => change(e.target.value as Role)}
      disabled={pending}
      className="text-xs rounded-lg border border-secondary-soft px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
    >
      {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  )
}

export function ToggleActiveButton({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => { await updateStaffUser(userId, { active: !active }) })
  }

  return (
    <button onClick={toggle} disabled={pending} className={`text-xs hover:underline disabled:opacity-50 ${active ? "text-danger" : "text-success"}`}>
      {pending ? "…" : active ? "Deactivate" : "Reactivate"}
    </button>
  )
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    setError("")
    startTransition(async () => {
      const res = await resetUserPassword(userId, password)
      if ("error" in res) { setError(res.error); return }
      setDone(true)
      setOpen(false)
    })
  }

  if (done) return <span className="text-xs text-success">Password updated</span>
  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-xs text-muted hover:text-ink">Reset password</button>
  )

  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="New password"
        className="text-xs rounded border border-secondary-soft px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary w-32"
        autoComplete="new-password"
      />
      <button onClick={save} disabled={pending} className="text-xs text-primary hover:underline disabled:opacity-50">
        {pending ? "…" : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">×</button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
