"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import InviteUserForm from "./InviteUserForm"

export default function InvitePanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
      {!open ? (
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Add a staff member</p>
              <p className="text-xs text-muted">Create an account with a name, email, role, and initial password.</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors shrink-0"
          >
            + Add user
          </button>
        </div>
      ) : (
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-ink">New staff account</h2>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ink text-lg leading-none">×</button>
          </div>
          <InviteUserForm onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
