"use client"

import { useState, useRef, useTransition } from "react"
import Link from "next/link"
import { updateClientStatus } from "@/app/actions/clients"
import { CLIENT_STATUSES, STATUS_LABELS, type ClientStatus } from "@/lib/client-utils"

type KanbanClient = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: ClientStatus
  createdAt: Date
  assignedAgent: { id: string; name: string | null } | null
  bestScore: number | null
  daysSinceActivity: number
}

type Props = {
  clients: KanbanClient[]
  canWrite: boolean
}

const COLUMN_ORDER: ClientStatus[] = [
  "LEAD",
  "CONTACTED",
  "CONSULT_SCHEDULED",
  "SIGNED",
  "ACTIVE",
  "PAUSED",
  "COMPLETE",
]

const COLUMN_ACCENT: Record<ClientStatus, string> = {
  LEAD:              "border-t-gray-400",
  CONTACTED:         "border-t-blue-400",
  CONSULT_SCHEDULED: "border-t-purple-400",
  SIGNED:            "border-t-yellow-400",
  ACTIVE:            "border-t-green-500",
  PAUSED:            "border-t-gray-300",
  COMPLETE:          "border-t-primary",
}

function initials(name: string | null | undefined) {
  if (!name) return "?"
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)
}

function ScoreChip({ score }: { score: number | null }) {
  if (!score) return <span className="text-xs text-muted/60">—</span>
  const color = score >= 740 ? "text-success" : score >= 670 ? "text-primary" : score >= 580 ? "text-warning" : "text-danger"
  return <span className={`text-xs font-bold ${color}`}>{score}</span>
}

function ClientCard({
  client,
  isDragging,
  onDragStart,
}: {
  client: KanbanClient
  isDragging: boolean
  onDragStart: (e: React.DragEvent) => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white rounded-lg border border-secondary-soft p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-40 scale-95" : "hover:shadow-md hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/clients/${client.id}`}
          className="text-sm font-semibold text-ink hover:text-primary transition-colors leading-tight"
          onClick={e => e.stopPropagation()}
        >
          {client.firstName} {client.lastName}
        </Link>
        <ScoreChip score={client.bestScore} />
      </div>

      <p className="text-xs text-muted truncate mb-2">{client.email ?? client.phone ?? "—"}</p>

      <div className="flex items-center justify-between">
        {client.assignedAgent ? (
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
              {initials(client.assignedAgent.name)}
            </span>
            <span className="text-xs text-muted">{client.assignedAgent.name?.split(" ")[0]}</span>
          </div>
        ) : (
          <span className="text-xs text-muted/50">Unassigned</span>
        )}
        <span className="text-[11px] text-muted/60">
          {client.daysSinceActivity === 0
            ? "Today"
            : client.daysSinceActivity === 1
            ? "Yesterday"
            : `${client.daysSinceActivity}d`}
        </span>
      </div>
    </div>
  )
}

export default function KanbanBoard({ clients: initial, canWrite }: Props) {
  const [clients, setClients] = useState(initial)
  const [pending, startTransition] = useTransition()
  const draggingId = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ClientStatus | null>(null)
  const [draggingClientId, setDraggingClientId] = useState<string | null>(null)

  const byStatus = Object.fromEntries(
    COLUMN_ORDER.map(s => [s, clients.filter(c => c.status === s)])
  ) as Record<ClientStatus, KanbanClient[]>

  function handleDragStart(e: React.DragEvent, clientId: string) {
    draggingId.current = clientId
    setDraggingClientId(clientId)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e: React.DragEvent, col: ClientStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCol(col)
  }

  function handleDrop(e: React.DragEvent, newStatus: ClientStatus) {
    e.preventDefault()
    setDragOverCol(null)
    const id = draggingId.current
    if (!id) return
    const client = clients.find(c => c.id === id)
    if (!client || client.status === newStatus) {
      draggingId.current = null
      setDraggingClientId(null)
      return
    }

    // Optimistic update
    setClients(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
    draggingId.current = null
    setDraggingClientId(null)

    if (!canWrite) return
    startTransition(async () => {
      const res = await updateClientStatus(id, newStatus)
      if (res && "error" in res) {
        // Revert on error
        setClients(prev => prev.map(c => c.id === id ? { ...c, status: client.status } : c))
      }
    })
  }

  function handleDragEnd() {
    setDraggingClientId(null)
    setDragOverCol(null)
    draggingId.current = null
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[600px]">
      {COLUMN_ORDER.map(col => {
        const colClients = byStatus[col]
        const isOver = dragOverCol === col
        return (
          <div
            key={col}
            className="flex-shrink-0 w-60"
            onDragOver={e => handleDragOver(e, col)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col)}
          >
            {/* Column header */}
            <div className={`bg-white rounded-xl border border-secondary-soft border-t-4 ${COLUMN_ACCENT[col]} p-3 mb-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">{STATUS_LABELS[col]}</span>
                <span className="text-xs font-bold bg-secondary-soft text-muted rounded-full px-2 py-0.5">
                  {colClients.length}
                </span>
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`space-y-2 min-h-[200px] rounded-xl p-1 transition-colors ${
                isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : ""
              }`}
            >
              {colClients.map(c => (
                <ClientCard
                  key={c.id}
                  client={c}
                  isDragging={draggingClientId === c.id}
                  onDragStart={e => handleDragStart(e, c.id)}
                />
              ))}

              {colClients.length === 0 && (
                <div className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                  isOver ? "border-primary/40 bg-primary/5" : "border-secondary-soft"
                }`}>
                  <p className="text-xs text-muted/50">Drop here</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
