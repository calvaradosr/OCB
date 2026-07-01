"use client"
import { useTransition } from "react"
import { togglePinNote } from "@/app/actions/notes"

export function PinNoteButton({
  noteId,
  pinned,
  canWrite,
}: {
  noteId: string
  pinned: boolean
  canWrite: boolean
}) {
  const [isPending, startTransition] = useTransition()

  // Non-writers still see that a note is pinned, but can't change it.
  if (!canWrite) {
    return pinned ? <span className="shrink-0 text-xs text-primary" title="Pinned">📌</span> : null
  }

  function toggle() {
    startTransition(async () => {
      await togglePinNote(noteId)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={pinned ? "Unpin note" : "Pin note"}
      className={`shrink-0 text-xs transition-opacity disabled:opacity-40 ${
        pinned ? "text-primary" : "text-muted opacity-50 hover:opacity-100"
      }`}
    >
      {pinned ? "📌 Pinned" : "📌 Pin"}
    </button>
  )
}
