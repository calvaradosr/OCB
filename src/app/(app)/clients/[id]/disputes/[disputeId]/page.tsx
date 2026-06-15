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
  const firstSentAt = dispute.items.find(it => it.sentAt)?.sentAt ?? null
  const firstDueAt = dispute.items.reduce<Date | null>((earliest, it) => {
    if (!it.dueAt) return earliest
    return !earliest || it.dueAt < earliest ? it.dueAt : earliest
  }, null)

  const now = new Date()
  const strategyLabel =
    DISPUTE_STRATEGIES.find(s => s.value === dispute.strategy)?.label ?? dispute.strategy

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <Link href={`/clients/${id}/disputes`} className="hover:text-ink">Disputes</Link>
        <span>›</span>
        <span className="text-ink font-medium">Round {dispute.round}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Round {dispute.round} — {strategyLabel}</h1>
          <p className="text-sm text-muted mt-0.5">
            Created {dispute.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}{dispute.items.length} items · {dispute.letters.length} letters
          </p>
        </div>
        {!isSent && <MarkSentButton disputeId={dispute.id} />}
      </div>

      {/* FCRA Clock */}
      <div className={`border rounded-lg p-4 flex items-center gap-4 ${
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
      <div className="border border-secondary-soft rounded-lg overflow-hidden">
        <div className="bg-secondary-soft/30 px-4 py-3">
          <h2 className="font-semibold text-ink">Disputed Items</h2>
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
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${DISPUTE_OUTCOME_COLORS[di.outcome] ?? ""}`}>
                      {DISPUTE_OUTCOME_LABELS[di.outcome] ?? di.outcome}
                    </span>
                    {isSent && (
                      <OutcomeForm disputeItemId={di.id} currentOutcome={di.outcome} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Letters */}
      <div className="border border-secondary-soft rounded-lg overflow-hidden">
        <div className="bg-secondary-soft/30 px-4 py-3">
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
