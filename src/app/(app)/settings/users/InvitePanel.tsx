"use client"

import { useState } from "react"
import InviteUserForm from "./InviteUserForm"

export default function InvitePanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-5">
      {!open ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Add a new staff member to your organization.</p>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            + Invite user
          </button>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-ink mb-4">Invite new user</h2>
          <InviteUserForm onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
