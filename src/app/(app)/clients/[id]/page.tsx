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
import { updateClientStatus } from "@/app/actions/clients"
import { addNote } from "@/app/actions/notes"
import { CLIENT_STATUSES, STATUS_LABELS } from "@/lib/client-utils"
import { isCreditReady, CREDIT_READINESS_THRESHOLD } from "@/lib/loan-utils"
import { AddNoteForm } from "./AddNoteForm"
import { StatusChanger } from "./StatusChanger"

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = (await auth())!
  if (!can(session.user.role, "clients:read")) redirect("/dashboard")

  const { id } = await params

  const client = await db.client.findUnique({
    where: { id },
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
    where: { entity: "Client", entityId: id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const canWrite = can(session.user.role, "clients:write")
  const canReadPII = can(session.user.role, "clients:read_pii")
  const timeline = mergeTimeline(client.notes as Parameters<typeof mergeTimeline>[0], auditEvents as Parameters<typeof mergeTimeline>[1])

  // Loan data: open files count + credit-readiness bridge
  const loanFiles = await db.loanFile.findMany({
    where: { clientId: id },
    select: { id: true, status: true, type: true },
  })
  const activeLoanFiles = loanFiles.filter(f => !["FUNDED","DECLINED","WITHDRAWN"].includes(f.status))

  const latestReport = await db.creditReport.findFirst({
    where: { clientId: id },
    orderBy: { pulledAt: "desc" },
    select: { scoreExperian: true, scoreEquifax: true, scoreTransunion: true },
  })
  const creditReady = latestReport
    ? isCreditReady({
        experian: latestReport.scoreExperian,
        equifax: latestReport.scoreEquifax,
        transunion: latestReport.scoreTransunion,
      })
    : false
  const hasNoLoanFile = loanFiles.length === 0
  const showLoanBridge = can(session.user.role, "loans:write") && creditReady && hasNoLoanFile && client.modules.includes("CREDIT_REPAIR")

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <Link href="/clients" className="text-sm text-muted hover:text-ink transition-colors">
        ← Clients
      </Link>

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
              {client.email && <span>{client.email}</span>}
              {client.phone && <span>{client.phone}</span>}
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
          {canWrite && (
            <Link
              href={`/clients/${id}/edit`}
              className="shrink-0 rounded-lg border border-secondary-soft px-4 py-2 text-sm text-muted hover:text-ink transition-colors"
            >
              Edit
            </Link>
          )}
        </div>

        {/* Address */}
        {client.addressLine1 && (
          <p className="mt-4 text-sm text-muted">
            {client.addressLine1}
            {client.addressLine2 ? `, ${client.addressLine2}` : ""}
            {client.city ? `, ${client.city}` : ""}
            {client.state ? `, ${client.state}` : ""}
            {client.zip ? ` ${client.zip}` : ""}
          </p>
        )}

        {/* PII section */}
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

        {/* Status changer */}
        {canWrite && <StatusChanger clientId={id} currentStatus={client.status} />}
      </div>

      {/* Quick links — credit repair + M3 */}
      <div className="grid grid-cols-2 gap-4">
        {client.modules.includes("CREDIT_REPAIR") && (
          <>
            <Link
              href={`/clients/${id}/reports`}
              className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
            >
              <div>
                <p className="font-semibold text-ink group-hover:text-primary">Credit Reports</p>
                <p className="text-xs text-muted mt-0.5">3-bureau item grid &amp; score tracking</p>
              </div>
              <span className="text-muted group-hover:text-primary">→</span>
            </Link>
            <Link
              href={`/clients/${id}/disputes`}
              className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
            >
              <div>
                <p className="font-semibold text-ink group-hover:text-primary">Disputes</p>
                <p className="text-xs text-muted mt-0.5">Dispute wizard, letters &amp; FCRA tracking</p>
              </div>
              <span className="text-muted group-hover:text-primary">→</span>
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
          <span className="text-muted group-hover:text-primary">→</span>
        </Link>
        <Link
          href={`/clients/${id}/agreements`}
          className="flex items-center justify-between bg-white border border-secondary-soft rounded-xl p-4 hover:border-primary transition-colors group"
        >
          <div>
            <p className="font-semibold text-ink group-hover:text-primary">Agreements</p>
            <p className="text-xs text-muted mt-0.5">Send CROA-compliant docs for e-sign</p>
          </div>
          <span className="text-muted group-hover:text-primary">→</span>
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
            <span className="text-muted group-hover:text-primary">→</span>
          </Link>
        )}
        {can(session.user.role, "loans:read") && (
          <Link
            href={`/loans/new?clientId=${id}`}
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
              <p className="text-xs text-muted mt-0.5">Loan processing pipeline</p>
            </div>
            <span className="text-muted group-hover:text-primary">→</span>
          </Link>
        )}
      </div>

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
