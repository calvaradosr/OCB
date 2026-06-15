"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { portalSendMessage } from "@/app/actions/portal"

type Msg = { id: string; senderRole: string; body: string; createdAt: string }

export default function MessageThread({ messages }: { messages: Msg[] }) {
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  function send() {
    if (!body.trim()) return
    setError("")
    startTransition(async () => {
      const res = await portalSendMessage(body)
      if ("error" in res) { setError(res.error); return }
      setBody("")
      router.refresh()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    })
  }

  return (
    <>
      <div className="h-96 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted mt-16">
            No messages yet. Send a message to your specialist below.
          </p>
        )}

        {messages.map(m => {
          const isClient = m.senderRole === "CLIENT"
          return (
            <div key={m.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm ${
                  isClient
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-secondary-soft text-ink rounded-bl-sm"
                }`}
              >
                <p>{m.body}</p>
                <p className={`text-xs mt-1 ${isClient ? "text-white/70" : "text-muted"}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {new Date(m.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-secondary-soft p-4">
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <div className="flex gap-2">
          <textarea
            className="flex-1 rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            placeholder="Type a message…"
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
            }}
            disabled={pending}
          />
          <button
            onClick={send}
            disabled={pending || !body.trim()}
            className="self-end px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-muted mt-1">Shift+Enter for new line · Enter to send</p>
      </div>
    </>
  )
}
