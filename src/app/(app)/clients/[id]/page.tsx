import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { StatusBadge } from "@/components/StatusBadge"
import { RevealPII } from "@/components/RevealPII"
import { ActivityTimeline, mergeTimeline } from "@/components/ActivityTimeline"
import { DocumentUpload } from "@/components/DocumentUpload"
import { DOCUMENT_CATEGORY_LABELS, formatFileSize } from "@/lib/client-utils"
import { isCreditReady, CREDIT_READINESS_THRESHOLD } from "@/lib/loan-utils"
import { AddNoteForm } from "./AddNoteForm"
import { StatusChanger } from "./StatusChanger"
import { clockLabel, isOverdue } from "@/lib/fcra"

function ScoreCard({ label, score }: { label: string; score: number | null | undefined }) {
  const color = !score ? "text-muted" : score >= 740 ? "text-success" : score >= 670 ? "text-primary" : score >= 580 ? "text-warning" : "text-danger"
  const grade = !score ? "—" : score >= 740 ? "Excellent" : score >= 670 ? "Good" : score >= 580 ? "Fair" : "Poor"
  return (
    <div className="bg-white rounded-xl border border-secondary-soft p-4 text-center">
      <p className="text-xs text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-4xl font-bold ${color}`}>{score ?? "—"}</p>
      <p className={`text-xs mt-1 font-medium ${color}`}>{grade}</p>
    </div>
  )
}

function WorkflowStep({ step, label, done, active }: { step: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
        ${done ? "bg-success border-success text-white" : active ? "bg-primary border-primary text-white" : "bg-white border-secondary-soft text-muted"}`}>
        {done ? "✓" : step}
      </div>
      <p className={`text-[10px] text-center leading-tight ${active ? "text-primary font-semibold" : done ? "text-success" : "text-muted"}`}>
        {label}
      </p>
    </div>
  )
}

function FCRAClockBadge({ sentAt, dueAt }: { sentAt: Date | null; dueAt: Date | null }) {
  const now = new Date()
  if (!sentAt) return <span className="text-xs text-muted bg-secondary-soft px-2 py-0.5 rounded-full">Not sent</span>
  const overdue = dueAt && isOverdue(dueAt, now)
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${overdue ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
      {clockLabel(sentAt, dueAt)}
    </span>
  )
}

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = (await auth())!
  if (!can(session.user.role, "clients:read")) redirect("/dashboard")
  const { orgId } = session.user

  const { id } = await params

  const client = await db.client.findUnique({
    where: { id, orgId },
    include: {
      assignedAgent: { select: { id: true, name: true } },
      documents: { orderBy: { createdAt: "desc" } },
      notes: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!client) notFound()

  const auditEvents = await db.auditLog.findMany({
    where: { orgId, entity: "Client", entityId: id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const canWrite = can(session.user.role, "clients:write")
  const canReadPII = can(session.user.role, "clients:read_pii")
  const timeline = mergeTimeline(client.notes as Parameters<typeof mergeTimeline>[0], auditEvents as Parameters<typeof mergeTimeline>[1])

  const isCR = client.modules.includes("CREDIT_REPAIR")

  // Credit Repair data
  const latestReport = isCR
    ? await db.creditReport.findFirst({
        where: { clientId: id },
        orderBy: { pulledAt: "desc" },
        include: { _count: { select: { items: true } } },
      })
    : null

  const itemStats = isCR
    ? await db.reportItem.aggregate({
        where: { clientId: id },
        _count: { _all: true },
      })
    : null

  const flaggedCount = isCR
    ? await db.reportItem.count({ where: { clientId: id, flagged: true } })
    : 0

  const allDisputes = isCR
    ? await db.dispute.findMany({
        where: { clientId: id },
        include: {
          items: { select: { id: true, outcome: true, sentAt: true, dueAt: true } },
          letters: { select: { id: true } },
        },
        orderBy: { round: "desc" },
      })
    : []

  // Count items currently in any dispute (pending)
  const inDisputeCount = isCR
    ? await db.disputeItem.count({ where: { dispute: { clientId: id }, outcome: "PENDING" } })
    : 0

  const deletedCount = isCR
    ? await db.disputeItem.count({ where: { dispute: { clientId: id }, outcome: "DELETED" } })
    : 0

  const totalItems = itemStats?._count._all ?? 0

  // Determine workflow stage
  const hasReport = !!latestReport
  const hasDispute = allDisputes.length > 0
  const latestDispute = allDisputes[0] ?? null
  const isSent = latestDispute?.items.some(it => it.sentAt) ?? false
  const hasResults = latestDispute?.items.some(it => it.outcome !== "PENDING") ?? false

  // Find FCRA clock for latest dispute
  const firstSentAt = latestDispute?.items.find(it => it.sentAt)?.sentAt ?? null
  const firstDueAt = latestDispute?.items.reduce<Date | null>((earliest, it) => {
    if (!it.dueAt) return earliest
    return !earliest || it.dueAt < earliest ? it.dueAt : earliest
  }, null) ?? null

  const workflowStage = !hasReport ? 1 : !hasDispute ? 2 : !isSent ? 3 : !hasResults ? 4 : 5

  // Loan data
  const loanFiles = await db.loanFile.findMany({
    where: { orgId, clientId: id },
    select: { id: true, status: true },
  })

  // Tradeline data
  const canTradelines = can(session.user.role, "tradelines:read")
  const activeTradelineOrders = canTradelines
    ? await db.tradelineOrder.count({
        where: { orgId, clientId: id, status: { notIn: ["REMOVED", "CANCELLED"] } },
      })
    : 0
  const hasTradeline = client.modules.includes("TRADELINE")
  const activeLoanFiles = loanFiles.filter(f => !["FUNDED","DECLINED","WITHDRAWN"].includes(f.status))
  const creditReady = latestReport
    ? isCreditReady({
        experian: latestReport.scoreExperian,
        equifax: latestReport.scoreEquifax,
        transunion: latestReport.scoreTransunion,
      })
    : false
  const showLoanBridge = can(session.user.role, "loans:write") && creditReady && loanFiles.length === 0 && isCR

  const deletionRate = totalItems > 0 ? Math.round((deletedCount / totalItems) * 100) : 0

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/clients" className="text-sm text-muted hover:text-ink transition-colors">← Clients</Link>

      {/* Profile header */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-ink">
                {client.firstName} {client.lastName}
              </h1>
              <StatusBadge status={client.status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {client.email && <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">{client.email}</a>}
              {client.phone && <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">{client.phone}</a>}
              {client.assignedAgent && <span>Agent: {client.assignedAgent.name}</span>}
            </div>
            {client.modules.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {client.modules.map(m => (
                  <span key={m} className="text-xs bg-secondary-soft text-ink rounded px-2 py-0.5">
                    {m.replace("_", " ")}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canWrite && (
              <Link
                href={`/clients/${id}/edit`}
                className="shrink-0 rounded-lg border border-secondary-soft px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
              >
                Edit
              </Link>
            )}
          </div>
        </div>

        {client.addressLine1 && (
          <p className="mt-4 text-sm text-muted">
            {client.addressLine1}
            {client.addressLine2 ? `, ${client.addressLine2}` : ""}
            {client.city ? `, ${client.city}` : ""}
            {client.state ? `, ${client.state}` : ""}
            {client.zip ? ` ${client.zip}` : ""}
          </p>
        )}

        {(client.ssnEncrypted || client.dobEncrypted) && (
          <div className="mt-4 pt-4 border-t border-secondary-soft grid grid-cols-2 gap-4 text-sm">
            {client.ssnEncrypted && (
              <div>
                <span className="text-muted mr-2">SSN</span>
                {canReadPII ? (
                  <RevealPII clientId={id} field="ssn" />
                ) : (
                  <span className="font-mono text-muted">●●●–●●–●●●●</span>
                )}
              </div>
            )}
            {client.dobEncrypted && (
              <div>
                <span className="text-muted mr-2">DOB</span>
                {canReadPII ? (
                  <RevealPII clientId={id} field="dob" placeholder="●●/●●/●●●●" />
                ) : (
                  <span className="font-mono text-muted">●●/●●/●●●●</span>
                )}
              </div>
            )}
          </div>
        )}

        {canWrite && <StatusChanger clientId={id} currentStatus={client.status} />}
      </div>

      {/* ─── CREDIT REPAIR DASHBOARD ─── */}
      {isCR && (
        <div className="space-y-4">
          {/* Score cards */}
          <div className="grid grid-cols-3 gap-4">
            <ScoreCard label="Experian" score={latestReport?.scoreExperian} />
            <ScoreCard label="Equifax" score={latestReport?.scoreEquifax} />
            <ScoreCard label="TransUnion" score={latestReport?.scoreTransunion} />
          </div>

          {/* Workflow progress */}
          <div className="bg-white rounded-xl border border-secondary-soft p-5">
            <p className="text-xs text-muted uppercase tracking-widest font-semibold mb-4">Credit Repair Workflow</p>
            <div className="relative flex items-start">
              {/* connector line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-secondary-soft -z-0" />
              <WorkflowStep step={1} label="Import Report" done={hasReport} active={workflowStage === 1} />
              <WorkflowStep step={2} label="Review Items" done={hasReport && hasDispute} active={workflowStage === 2} />
              <WorkflowStep step={3} label="Create Dispute" done={hasDispute} active={workflowStage === 3} />
              <WorkflowStep step={4} label="Send Letters" done={isSent} active={workflowStage === 4} />
              <WorkflowStep step={5} label="Track Results" done={hasResults} active={workflowStage === 5} />
            </div>

            {/* Next action prompt */}
            <div className="mt-4 pt-4 border-t border-secondary-soft flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {workflowStage === 1 && "No credit report yet. Import to get started."}
                {workflowStage === 2 && `${totalItems} item${totalItems !== 1 ? "s" : ""} imported — review and flag items to dispute.`}
                {workflowStage === 3 && `${flaggedCount} item${flaggedCount !== 1 ? "s" : ""} flagged — create a dispute round.`}
                {workflowStage === 4 && "Dispute created — print and mail letters, then mark as sent."}
                {workflowStage === 5 && `FCRA clock running — record outcomes as bureau responses arrive.`}
              </p>
              <Link
                href={
                  workflowStage <= 1 ? `/clients/${id}/reports/import` :
                  workflowStage === 2 ? `/clients/${id}/reports` :
                  workflowStage === 3 ? `/clients/${id}/disputes/new` :
                  workflowStage === 4 ? (latestDispute ? `/clients/${id}/disputes/${latestDispute.id}` : `/clients/${id}/disputes`) :
                  `/clients/${id}/disputes`
                }
                className="shrink-0 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                {workflowStage <= 1 ? "Import Report →" :
                 workflowStage === 2 ? "Review Items →" :
                 workflowStage === 3 ? "Start Dispute →" :
                 workflowStage === 4 ? "View Dispute →" :
                 "View Results →"}
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Items", value: totalItems, color: "text-ink" },
              { label: "Flagged", value: flaggedCount, color: "text-warning" },
              { label: "In Dispute", value: inDisputeCount, color: "text-primary" },
              { label: `Deleted (${deletionRate}%)`, value: deletedCount, color: "text-success" },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-secondary-soft p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Active dispute round */}
          {latestDispute && (
            <div className="bg-white rounded-xl border border-secondary-soft p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-ink">Latest Dispute Round</h2>
                <Link href={`/clients/${id}/disputes`} className="text-xs text-primary hover:underline">
                  All rounds →
                </Link>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
                    {latestDispute.round}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">Round {latestDispute.round}</p>
                    <p className="text-xs text-muted">{latestDispute.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <p className="font-semibold text-ink">{latestDispute.items.length}</p>
                    <p className="text-xs text-muted">Items</p>
                  </div>
                  <div>
                    <p className="font-semibold text-success">{latestDispute.items.filter(i => i.outcome === "DELETED").length}</p>
                    <p className="text-xs text-muted">Deleted</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{latestDispute.letters.length}</p>
                    <p className="text-xs text-muted">Letters</p>
                  </div>
                </div>
                <FCRAClockBadge sentAt={firstSentAt} dueAt={firstDueAt} />
                <Link
                  href={`/clients/${id}/disputes/${latestDispute.id}`}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Credit-readiness bridge */}
      {showLoanBridge && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-success">Credit-ready for a loan</p>
            <p className="text-xs text-ink mt-0.5">
              All bureau scores are at or above {CREDIT_READINESS_THRESHOLD}. This client may be ready to enter the loan pipeline.
            </p>
          </div>
          <Link
            href={`/loans/new?clientId=${id}`}
            className="shrink-0 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/80 transition-colors"
          >
            Create Loan File
          </Link>
        </div>
      )}

      {/* Module quick-links */}
      <div className="grid grid-cols-2 gap-4">
        {isCR && (
          <>
            <Link
              href={`/clients/${id}/reports`}
              className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
            >
              <div>
                <p className="font-semibold text-ink group-hover:text-primary">Credit Reports</p>
                <p className="text-xs text-muted mt-0.5">
                  {latestReport
                    ? `${latestReport._count.items} items · ${latestReport.pulledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : "No report imported yet"}
                </p>
              </div>
              <span className="text-muted group-hover:text-primary text-lg">→</span>
            </Link>
            <Link
              href={`/clients/${id}/disputes`}
              className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
            >
              <div>
                <p className="font-semibold text-ink group-hover:text-primary">Disputes</p>
                <p className="text-xs text-muted mt-0.5">
                  {allDisputes.length > 0 ? `${allDisputes.length} round${allDisputes.length !== 1 ? "s" : ""} · ${deletedCount} deleted` : "No disputes yet"}
                </p>
              </div>
              <span className="text-muted group-hover:text-primary text-lg">→</span>
            </Link>
          </>
        )}
        <Link
          href={`/clients/${id}/messages`}
          className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
        >
          <div>
            <p className="font-semibold text-ink group-hover:text-primary">Messages</p>
            <p className="text-xs text-muted mt-0.5">Secure client messaging</p>
          </div>
          <span className="text-muted group-hover:text-primary text-lg">→</span>
        </Link>
        <Link
          href={`/clients/${id}/agreements`}
          className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
        >
          <div>
            <p className="font-semibold text-ink group-hover:text-primary">Agreements</p>
            <p className="text-xs text-muted mt-0.5">CROA-compliant docs for e-sign</p>
          </div>
          <span className="text-muted group-hover:text-primary text-lg">→</span>
        </Link>
        {can(session.user.role, "billing:read") && (
          <Link
            href={`/clients/${id}/billing`}
            className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
          >
            <div>
              <p className="font-semibold text-ink group-hover:text-primary">Billing</p>
              <p className="text-xs text-muted mt-0.5">Invoices, subscriptions &amp; Stripe</p>
            </div>
            <span className="text-muted group-hover:text-primary text-lg">→</span>
          </Link>
        )}
        {can(session.user.role, "loans:read") && (
          <Link
            href={activeLoanFiles.length > 0 ? `/loans?clientId=${id}` : `/loans/new?clientId=${id}`}
            className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
          >
            <div>
              <p className="font-semibold text-ink group-hover:text-primary">
                Loan Files
                {activeLoanFiles.length > 0 && (
                  <span className="ml-2 text-xs font-normal bg-secondary-soft text-muted px-1.5 py-0.5 rounded-full">
                    {activeLoanFiles.length} active
                  </span>
                )}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {activeLoanFiles.length > 0 ? "Loan processing pipeline" : "Start a loan file"}
              </p>
            </div>
            <span className="text-muted group-hover:text-primary text-lg">→</span>
          </Link>
        )}
        {canTradelines && (
          <Link
            href={`/clients/${id}/tradelines`}
            className={`flex items-center justify-between rounded-xl p-4 hover:border-primary transition-colors group ${
              hasTradeline
                ? "bg-white border border-secondary-soft"
                : "bg-primary/5 border border-primary/20 hover:bg-primary/10"
            }`}
          >
            <div>
              <p className="font-semibold text-ink group-hover:text-primary">
                Tradelines
                {hasTradeline && activeTradelineOrders > 0 && (
                  <span className="ml-2 text-xs font-normal bg-secondary-soft text-muted px-1.5 py-0.5 rounded-full">
                    {activeTradelineOrders} active
                  </span>
                )}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {hasTradeline
                  ? activeTradelineOrders > 0
                    ? "View AU spot orders"
                    : "No active orders"
                  : "Boost this client's profile with an AU spot"}
              </p>
            </div>
            <span className="text-muted group-hover:text-primary text-lg">→</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documents */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
          <h2 className="font-semibold text-ink">Documents</h2>

          {client.documents.length === 0 ? (
            <p className="text-sm text-muted">No documents uploaded.</p>
          ) : (
            <ul className="space-y-2">
              {client.documents.map(doc => (
                <li key={doc.id} className="text-sm">
                  <p className="text-ink font-medium truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted">
                    {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                    {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ""}
                    {" · "}{new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <div className="pt-2 border-t border-secondary-soft">
              <DocumentUpload clientId={id} />
            </div>
          )}
        </div>

        {/* Activity timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-soft p-6 space-y-4">
          <h2 className="font-semibold text-ink">Activity</h2>
          {canWrite && <AddNoteForm clientId={id} />}
          <ActivityTimeline items={timeline} />
        </div>
      </div>
    </div>
  )
}
