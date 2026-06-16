"use client"

import { useActionState } from "react"
import { createFirstAdmin } from "@/app/actions/setup"

const initial = { error: "" }

export default function SetupForm() {
  const [state, action, pending] = useActionState(
    async (_prev: { error: string }, fd: FormData) => {
      const res = await createFirstAdmin(fd)
      return res ?? { error: "" }
    },
    initial,
  )

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-ink mb-1">Full name</label>
        <input
          name="name"
          type="text"
          required
          placeholder="Jane Smith"
          className="w-full rounded-lg border border-secondary-soft px-4 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="admin@yourcompany.com"
          className="w-full rounded-lg border border-secondary-soft px-4 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1">Password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="w-full rounded-lg border border-secondary-soft px-4 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-medium py-2.5 transition-colors"
      >
        {pending ? "Creating account…" : "Create admin account"}
      </button>
    </form>
  )
}
