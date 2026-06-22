"use client"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { togglePinNote } from "@/app/actions/notes"

export function PinNoteButton({ noteId, pinned }: { noteId: string; pinned: boolean }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function toggle() {
    startTransition(async () => {
      const res = await togglePinNote(noteId)
      if (!res?.error) router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={pinned ? "Unpin note" : "Pin note"}
      aria-pressed={pinned}
      className={`shrink-0 rounded p-1 transition-colors disabled:opacity-50 ${
        pinned ? "text-primary hover:text-primary-dark" : "text-muted hover:text-ink"
      }`}
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 16 16"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M9.5 1.5l5 5-3 .8-2.2 4.2-1.3-1.3L3.5 14l4.8-4.2-1.3-1.3 4.2-2.2.3-3z" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
