"use client"
import { useFormState, useFormStatus } from "react-dom"
import { useEffect, useRef, useState } from "react"
import { addNote } from "@/app/actions/notes"

const NOTE_TYPES = [
  { value: "note", label: "Note", icon: "📝" },
  { value: "call", label: "Call", icon: "📞" },
  { value: "email", label: "Email", icon: "✉️" },
  { value: "meeting", label: "Meeting", icon: "🤝" },
  { value: "task", label: "Task", icon: "✅" },
]

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
  const [noteType, setNoteType] = useState("note")

  useEffect(() => {
    if (!state?.error) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="noteType" value={noteType} />

      {/* Type selector */}
      <div className="flex gap-1">
        {NOTE_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setNoteType(t.value)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              noteType === t.value
                ? "bg-primary text-white"
                : "bg-secondary-soft text-muted hover:text-ink"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        name="body"
        rows={3}
        placeholder={`Log a ${noteType}…`}
        required
        className="w-full rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      />
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
