// Combines Notes and AuditLog entries into a single chronological feed.
type TimelineItem =
  | { kind: "note"; id: string; body: string; authorName: string; createdAt: Date }
  | { kind: "event"; id: string; action: string; detail: unknown; actorName: string | null; createdAt: Date }

function formatDate(d: Date) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function eventLabel(action: string, detail: unknown): string {
  const d = detail as Record<string, unknown> | null
  switch (action) {
    case "CREATE":
      return "Client record created"
    case "UPDATE":
      if (d?.field === "status") return `Status changed to ${d?.value}`
      if (d?.piiField) return `Viewed encrypted ${d.piiField} field`
      return "Record updated"
    case "LOGIN":
      return "User logged in"
    default:
      return action.toLowerCase().replace("_", " ")
  }
}

const NOTE_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  "[Call]": { label: "Call", cls: "bg-primary/10 text-primary" },
  "[Email]": { label: "Email", cls: "bg-success/10 text-success" },
  "[Meeting]": { label: "Meeting", cls: "bg-warning/10 text-warning" },
  "[Task]": { label: "Task", cls: "bg-secondary text-white" },
}

function NoteBody({ body }: { body: string }) {
  for (const [prefix, badge] of Object.entries(NOTE_TYPE_BADGE)) {
    if (body.startsWith(prefix + " ")) {
      const text = body.slice(prefix.length + 1)
      return (
        <div className="flex gap-2 items-start">
          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>
          <p className="text-sm text-ink whitespace-pre-wrap">{text}</p>
        </div>
      )
    }
  }
  return <p className="text-sm text-ink whitespace-pre-wrap">{body}</p>
}

export function ActivityTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted py-4">No activity yet.</p>
  }

  return (
    <ol className="relative border-l border-secondary-soft ml-3 space-y-0">
      {items.map((item, i) => (
        <li key={item.id} className="mb-6 ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-secondary-soft">
            {item.kind === "note" ? (
              <svg className="h-3 w-3 text-primary" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2.5 1A1.5 1.5 0 001 2.5v11A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 1h-11zM4 5.5a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h4a.5.5 0 010 1h-4a.5.5 0 01-.5-.5z" />
              </svg>
            ) : (
              <span className="h-2 w-2 rounded-full bg-secondary" />
            )}
          </span>

          {item.kind === "note" ? (
            <div className="bg-secondary-soft rounded-lg p-3">
              <NoteBody body={item.body} />
              <p className="text-xs text-muted mt-1">
                {item.authorName} · {formatDate(item.createdAt)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink">{eventLabel(item.action, item.detail)}</p>
              <p className="text-xs text-muted">
                {item.actorName ? `${item.actorName} · ` : ""}
                {formatDate(item.createdAt)}
              </p>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

// Merges and sorts notes + audit log entries into one feed, newest first.
export function mergeTimeline(
  notes: Array<{ id: string; body: string; author: { name: string }; createdAt: Date }>,
  events: Array<{
    id: string
    action: string
    detail: unknown
    actor: { name: string } | null
    createdAt: Date
  }>
): TimelineItem[] {
  const noteItems: TimelineItem[] = notes.map(n => ({
    kind: "note",
    id: n.id,
    body: n.body,
    authorName: n.author.name,
    createdAt: n.createdAt,
  }))

  const eventItems: TimelineItem[] = events.map(e => ({
    kind: "event",
    id: e.id,
    action: e.action,
    detail: e.detail,
    actorName: e.actor?.name ?? null,
    createdAt: e.createdAt,
  }))

  return [...noteItems, ...eventItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}
