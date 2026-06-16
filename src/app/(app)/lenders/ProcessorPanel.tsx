"use client"

import { useState, useTransition } from "react"
import { createStaffUser, updateStaffUser, resetUserPassword } from "@/app/actions/users"

type Processor = {
  id: string
  name: string
  email: string
  active: boolean
  _count: { loanFiles: number }
}

function AddProcessorForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const field = "rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary w-full"

  function submit() {
    if (!name.trim() || !email.trim() || !password) { setError("All fields are required."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    setError("")
    startTransition(async () => {
      const res = await createStaffUser({ name, email, password, role: "LOAN_PROCESSOR" })
      if ("error" in res) { setError(res.error); return }
      onDone()
    })
  }

  return (
    <div className="bg-secondary-soft/20 rounded-xl border border-secondary-soft p-5 space-y-3">
      <p className="text-sm font-medium text-ink">Add processor</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Full name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={field} placeholder="Jane Smith" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={field} placeholder="jane@example.com" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Temporary password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={field} placeholder="Min. 8 characters" autoComplete="new-password" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={pending} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
          {pending ? "Adding…" : "Add processor"}
        </button>
        <button onClick={onDone} className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ResetPasswordInline({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState("")
  const [done, setDone] = useState(false)
  const [err, setErr] = useState("")
  const [pending, start] = useTransition()

  if (done) return <span className="text-xs text-success">Password updated</span>
  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-xs text-muted hover:text-ink">Reset password</button>
  )
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        className="text-xs rounded border border-secondary-soft px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button onClick={() => {
        setErr("")
        start(async () => {
          const res = await resetUserPassword(userId, pw)
          if ("error" in res) { setErr(res.error); return }
          setDone(true)
        })
      }} disabled={pending} className="text-xs text-primary hover:underline disabled:opacity-50">
        {pending ? "…" : "Save"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-muted">×</button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  )
}

export default function ProcessorPanel({
  processors,
  canManage,
}: {
  processors: Processor[]
  canManage: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [localList, setLocalList] = useState(processors)
  const [pending, start] = useTransition()

  function toggleActive(userId: string, current: boolean) {
    start(async () => {
      await updateStaffUser(userId, { active: !current })
      setLocalList(prev => prev.map(p => p.id === userId ? { ...p, active: !current } : p))
    })
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              + Add Processor
            </button>
          )}
        </div>
      )}

      {adding && (
        <AddProcessorForm onDone={() => { setAdding(false); window.location.reload() }} />
      )}

      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        {localList.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-muted text-sm">No loan processors yet.</p>
            {canManage && (
              <button onClick={() => setAdding(true)} className="mt-2 text-sm text-primary hover:underline">
                Add your first processor
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Name</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Email</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Active files</th>
                <th className="px-5 py-3 text-left text-xs text-muted font-medium">Status</th>
                {canManage && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {localList.map(p => (
                <tr key={p.id} className={`hover:bg-secondary-soft/20 ${!p.active ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3 font-medium text-ink">{p.name}</td>
                  <td className="px-5 py-3 text-muted text-xs">{p.email}</td>
                  <td className="px-5 py-3 text-muted">{p._count.loanFiles}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${p.active ? "text-success" : "text-muted"}`}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleActive(p.id, p.active)}
                          disabled={pending}
                          className={`text-xs hover:underline disabled:opacity-50 ${p.active ? "text-danger" : "text-success"}`}
                        >
                          {p.active ? "Deactivate" : "Reactivate"}
                        </button>
                        <ResetPasswordInline userId={p.id} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
