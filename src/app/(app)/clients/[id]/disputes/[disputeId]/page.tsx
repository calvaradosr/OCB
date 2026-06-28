import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { clockLabel, isOverdue, daysRemaining } from "@/lib/fcra"
import {
  DISPUTE_STRATEGIES,
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_OUTCOME_COLORS,
  LETTER_TARGET_LABELS,
  BUREAU_LABELS,
  type BureauValue,
} from "@/lib/report-utils"
import { MarkSentButton } from "./MarkSentButton"
import { OutcomeForm } from "./OutcomeForm"

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string; disputeId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id, disputeId } = await params

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: {
      items: {
        include: {
          item: { select: { creditorName: true, accountNumberMasked: true, type: true } },
        },
        orderBy: { bureau: "asc" },
      },
      letters: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!dispute || dispute.clientId !== id) notFound()

  const isSent = dispute.items.some(it => it.sentAt !== null)
  const allResolved = isSent && dispute.items.length > 0 && dispute.items.every(di => di.outcome !== "PENDING")
  const resolvedDeletedCount = dispute.items.filter(di => di.outcome === "DELETED").length
  const firstSentAt = dispute.items.find(it => it.sentAt)?.sentAt ?? null
  const firstDueAt = dispute.items.reduce<Date | null>((earliest, it) => {
    if (!it.dueAt) return earliest
    return !earliest || it.dueAt < earliest ? it.dueAt : earliest
  }, null)

  const now = new Date()
  const strategyLabel =
    DISPUTE_STRATEGIES.find(s => s.value === dispute.strategy)?.label ?? dispute.strategy

  return (
    <div className="max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <Link href={`/clients/${id}/disputes`} className="hover:text-ink">Blocks</Link>
        <span>›</span>
        <span className="text-ink font-medium">Round {dispute.round}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{dispute.round}</span>
              </div>
              <h1 className="text-2xl font-bold text-ink">Round {dispute.round}</h1>
            </div>
            <p className="text-sm text-muted">
              {strategyLabel} · Created {dispute.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {" · "}{dispute.items.length} items · {dispute.letters.length} letters
            </p>
          </div>
          {!isSent && dispute.letters.length > 0 && (
            <MarkSentButton disputeId={dispute.id} />
          )}
        </div>

        {/* Next action prompt */}
        {!isSent && (
          <div className="mt-4 pt-4 border-t border-secondary-soft">
            {dispute.letters.length === 0 ? (
              <p className="text-sm text-warning">No letters generated yet. Go back and run the blocking wizard.</p>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-ink">Next step: Print &amp; mail letters</p>
                  <p className="text-xs text-muted mt-0.5">
                    Download each letter, print, send via certified mail, then click &quot;Mark as Sent&quot; to start the FCRA 30-day clock.
                  </p>
                </div>
                <MarkSentButton disputeId={dispute.id} />
              </div>
            )}
          </div>
        )}
        {isSent && !allResolved && (
          <div className="mt-4 pt-4 border-t border-secondary-soft">
            <p className="text-sm font-medium text-ink">Next step: Record outcomes as responses arrive</p>
            <p className="text-xs text-muted mt-0.5">
              Use the outcome dropdowns below to record bureau responses. FCRA requires response within 30 days of receipt.
            </p>
          </div>
        )}
        {allResolved && (
          <div className="mt-4 pt-4 border-t border-secondary-soft">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">All outcomes recorded</span>
                </div>
                <p className="text-sm font-medium text-ink">
                  {resolvedDeletedCount > 0
                    ? `${resolvedDeletedCount} item${resolvedDeletedCount !== 1 ? "s" : ""} blocked — ready to start Round ${dispute.round + 1}`
                    : `Round ${dispute.round} complete — ready to escalate with Round ${dispute.round + 1}`}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Items that were verified or received no response can be blocked again with stronger language or escalated to CFPB.
                </p>
              </div>
              <Link
                href={`/clients/${id}/disputes/new`}
                className="shrink-0 px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                Start Round {dispute.round + 1} →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* FCRA Clock */}
      <div className={`border rounded-xl p-5 flex items-center gap-4 ${
        !isSent ? "border-secondary-soft bg-secondary-soft/20" :
        firstDueAt && isOverdue(firstDueAt, now) ? "border-danger/30 bg-danger/5" :
        "border-success/30 bg-success/5"
      }`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          !isSent ? "bg-muted" :
          firstDueAt && isOverdue(firstDueAt, now) ? "bg-danger" :
          "bg-success"
        }`} />
        <div className="text-sm">
          <p className="font-medium text-ink">FCRA 30-Day Clock</p>
          {firstSentAt && (
            <p className="text-muted text-xs mt-0.5">
              Sent: {firstSentAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {firstDueAt && (
                <> · Due: {firstDueAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}<strong className={isOverdue(firstDueAt, now) ? "text-danger" : "text-success"}>
                  {clockLabel(firstSentAt, firstDueAt)}
                </strong></>
              )}
            </p>
          )}
          {!isSent && (
            <p className="text-muted text-xs mt-0.5">Clock starts when letters are marked as sent.</p>
          )}
        </div>
      </div>

      {/* Dispute items */}
      <div className="bg-white border border-secondary-soft rounded-xl overflow-hidden">
        <div className="bg-secondary-soft/30 px-5 py-3 border-b border-secondary-soft">
          <h2 className="font-semibold text-ink">Items in This Block</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead className="border-b border-secondary-soft">
            <tr className="text-xs text-muted uppercase tracking-wide">
              <th className="py-3 px-4 text-left">Creditor</th>
              <th className="py-3 px-4 text-left">Bureau</th>
              <th className="py-3 px-4 text-left">Sent</th>
              <th className="py-3 px-4 text-left">Due</th>
              <th className="py-3 px-4 text-left">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-soft">
            {dispute.items.map(di => (
              <tr key={di.id} className="hover:bg-secondary-soft/10">
                <td className="py-3 px-4">
                  <p className="font-medium text-ink">{di.item.creditorName}</p>
                  {di.item.accountNumberMasked && (
                    <p className="text-xs text-muted">{di.item.accountNumberMasked}</p>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs bg-secondary-soft px-2 py-0.5 rounded font-medium">
                    {BUREAU_LABELS[di.bureau as BureauValue] ?? di.bureau}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted text-xs">
                  {di.sentAt ? di.sentAt.toLocaleDateString("en-US") : "—"}
                </td>
                <td className="py-3 px-4 text-xs">
                  {di.dueAt ? (
                    <span className={isOverdue(di.dueAt, now) ? "text-danger font-medium" : "text-success"}>
                      {di.dueAt.toLocaleDateString("en-US")}
                    </span>
                  ) : "—"}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-start gap-2 flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${DISPUTE_OUTCOME_COLORS[di.outcome] ?? ""}`}>
                        {DISPUTE_OUTCOME_LABELS[di.outcome] ?? di.outcome}
                      </span>
                      {di.resolvedAt && di.outcome !== "PENDING" && (
                        <span className="text-xs text-muted">
                          {di.resolvedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      {isSent && (
                        <OutcomeForm disputeItemId={di.id} currentOutcome={di.outcome} />
                      )}
                    </div>
                    {di.responseNote && (
                      <p className="text-xs text-muted italic">{di.responseNote}</p>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Letters */}
      <div className="bg-white border border-secondary-soft rounded-xl overflow-hidden">
        <div className="bg-secondary-soft/30 px-5 py-3 border-b border-secondary-soft">
          <h2 className="font-semibold text-ink">Generated Letters</h2>
        </div>
        {dispute.letters.length === 0 ? (
          <p className="text-sm text-muted p-6 text-center">No letters generated.</p>
        ) : (
          <div className="divide-y divide-secondary-soft">
            {dispute.letters.map(letter => (
              <div key={letter.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary-soft/10">
                <div>
                  <p className="font-medium text-ink text-sm">
                    {LETTER_TARGET_LABELS[letter.target] ?? letter.target}
                    {letter.bureau && ` — ${BUREAU_LABELS[letter.bureau as BureauValue] ?? letter.bureau}`}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {letter.sentAt
                      ? `Sent ${letter.sentAt.toLocaleDateString("en-US")}`
                      : "Draft — not sent"}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={`/api/letters/${letter.id}/view`}
                    target="_blank"
                    className="text-sm text-primary hover:underline"
                  >
                    View / Print
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

