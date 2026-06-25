"use client"

import { useState, useTransition } from "react"
import { updateOrganization } from "@/app/actions/organization"

export default function OrgSettingsForm({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function save() {
    setError("")
    setSaved(false)
    startTransition(async () => {
      const res = await updateOrganization({ name })
      if ("error" in res) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={e => { setName(e.target.value); setSaved(false) }}
        className="flex-1 rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Organization name"
      />
      <button
        onClick={save}
        disabled={pending || !name.trim()}
        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {pending ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
