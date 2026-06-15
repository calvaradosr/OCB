"use client"
import { useFormState, useFormStatus } from "react-dom"
import { useEffect, useRef } from "react"
import { addNote } from "@/app/actions/notes"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition-colors"
    >
      {pending ? "Adding…" : "Add note"}
    </button>
  )
}

export function AddNoteForm({ clientId }: { clientId: string }) {
  const [state, action] = useFormState(addNote, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the textarea after a successful note
  useEffect(() => {
    if (!state?.error) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="clientId" value={clientId} />
      <textarea
        name="body"
        rows={3}
        placeholder="Add a note…"
        required
        className="w-full rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      />
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
