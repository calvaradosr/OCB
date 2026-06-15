import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import Link from "next/link"
import {
  LOAN_STATUS_LABELS,
  LOAN_STATUS_COLORS,
  LOAN_TYPE_LABELS,
  PIPELINE_STAGES,
  LOAN_DOC_CHECKLIST,
  LOAN_DOC_LABELS,
  VALID_TRANSITIONS,
} from "@/lib/loan-utils"
import { LoanStatus } from "@prisma/client"
import LoanStatusChanger from "./LoanStatusChanger"
import ConditionPanel from "./ConditionPanel"
import LoanDocUpload from "./LoanDocUpload"
import LoanEditForm from "./LoanEditForm"

function dollars(cents: number | null | undefined) {
  if (!cents) return "—"
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
}

export default async function LoanFilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:read")) redirect("/dashboard")

  const loanFile = await db.loanFile.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, status: true } },
      lender: true,
      processor: { select: { id: true, name: true } },
      conditions: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  })

  if (!loanFile) notFound()

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "LoanFile",
    entityId: id,
  }).catch(() => {})

  const canWrite = can(session.user.role, "loans:write")
  const statusColors = LOAN_STATUS_COLORS[loanFile.status]
  const allowedNext = VALID_TRANSITIONS[loanFile.status] ?? []

  // Doc checklist
  const requiredDocs = LOAN_DOC_CHECKLIST[loanFile.type]
  const uploadedByCategory = loanFile.documents.reduce<Record<string, number>>(
    (acc, d) => { acc[d.category] = (acc[d.category] ?? 0) + 1; return acc },
    {}
  )

  // Pipeline stepper index
  const stageIndex = PIPELINE_STAGES.indexOf(loanFile.status)

  // Lenders for edit form
  const lenders = await db.lender.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const processors = await db.user.findMany({
    where: { role: { in: ["LOAN_PROCESSOR", "MANAGER", "ADMIN"] }, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <Link href="/loans" className="text-sm text-muted hover:text-ink transition-colors">
        ← Loan Pipeline
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-secondary-soft p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-ink">
                {loanFile.client.firstName} {loanFile.client.lastName}
              </h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors.bg} ${statusColors.text}`}>
                {LOAN_STATUS_LABELS[loanFile.status]}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span>{LOAN_TYPE_LABELS[loanFile.type]}</span>
              {loanFile.lender && <span>{loanFile.lender.name}</span>}
              {loanFile.processor && <span>Processor: {loanFile.processor.name}</span>}
              {loanFile.amountRequestedCents && (
                <span>Requested: {dollars(loanFile.amountRequestedCents)}</span>
              )}
              {loanFile.amountApprovedCents && (
                <span className="text-success font-medium">Approved: {dollars(loanFile.amountApprovedCents)}</span>
              )}
              {loanFile.interestRate && (
                <span>Rate: {Number(loanFile.interestRate).toFixed(2)}%</span>
              )}
              {loanFile.termMonths && <span>Term: {loanFile.termMonths}mo</span>}
            </div>
            <Link href={`/clients/${loanFile.client.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
              View client profile →
            </Link>
          </div>
        </div>
      </div>

      {/* Pipeline stepper */}
      <div className="bg-white rounded-xl border border-secondary-soft p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Pipeline Stage</h2>
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = stageIndex > i
            const current = stageIndex === i
            const stageColors = LOAN_STATUS_COLORS[stage]
            return (
              <div key={stage} className="flex items-center">
                <div
                  className={`flex flex-col items-center px-2 ${
                    current ? "opacity-100" : done ? "opacity-70" : "opacity-30"
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? "bg-success text-white" : current ? `${stageColors.bg} ${stageColors.text}` : "bg-secondary-soft text-muted"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span className="text-xs text-muted mt-1 whitespace-nowrap text-center leading-tight max-w-16">
                    {LOAN_STATUS_LABELS[stage]}
                  </span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className={`h-0.5 w-6 shrink-0 ${done ? "bg-success" : "bg-secondary-soft"}`} />
                )}
              </div>
            )
          })}
        </div>

        {canWrite && allowedNext.length > 0 && (
          <div className="mt-4 pt-4 border-t border-secondary-soft">
            <LoanStatusChanger loanFileId={id} currentStatus={loanFile.status} allowedNext={allowedNext as LoanStatus[]} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Conditions */}
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <h2 className="text-sm font-semibold text-ink mb-3">Conditions</h2>
          <ConditionPanel
            loanFileId={id}
            conditions={loanFile.conditions.map(c => ({
              id: c.id,
              description: c.description,
              status: c.status,
              clearedAt: c.clearedAt?.toISOString() ?? null,
            }))}
            canWrite={canWrite}
          />
        </div>

        {/* Edit financials */}
        {canWrite && (
          <div className="bg-white rounded-xl border border-secondary-soft p-5">
            <h2 className="text-sm font-semibold text-ink mb-3">File Details</h2>
            <LoanEditForm
              loanFileId={id}
              lenders={lenders}
              processors={processors}
              defaults={{
                lenderId: loanFile.lenderId ?? "",
                processorId: loanFile.processorId ?? "",
                amountApprovedCents: loanFile.amountApprovedCents,
                interestRate: loanFile.interestRate ? Number(loanFile.interestRate) : null,
                termMonths: loanFile.termMonths,
                commissionCents: loanFile.commissionCents,
                notes: loanFile.notes ?? "",
              }}
            />
          </div>
        )}
      </div>

      {/* Document checklist */}
      <div className="bg-white rounded-xl border border-secondary-soft p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Document Checklist</h2>
        <div className="space-y-3">
          {requiredDocs.map(cat => {
            const count = uploadedByCategory[cat] ?? 0
            const docs = loanFile.documents.filter(d => d.category === cat)
            return (
              <div key={cat} className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      count > 0 ? "border-success bg-success" : "border-warning"
                    }`}
                  >
                    {count > 0 && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{LOAN_DOC_LABELS[cat] ?? cat}</p>
                    {docs.map(d => (
                      <p key={d.id} className="text-xs text-muted mt-0.5">
                        {d.fileName} · {d.createdAt.toLocaleDateString()}
                      </p>
                    ))}
                  </div>
                </div>
                {canWrite && (
                  <LoanDocUpload loanFileId={id} category={cat} />
                )}
              </div>
            )
          })}

          {/* Other docs already uploaded outside checklist */}
          {loanFile.documents
            .filter(d => !requiredDocs.includes(d.category))
            .map(d => (
              <div key={d.id} className="flex items-center gap-2 text-xs text-muted pl-8">
                <span>{d.fileName}</span>
                <span>·</span>
                <span>{d.category}</span>
                <span>·</span>
                <span>{d.createdAt.toLocaleDateString()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Lender contact info */}
      {loanFile.lender && (
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <h2 className="text-sm font-semibold text-ink mb-3">Lender</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted">Name</p>
              <p className="text-ink">{loanFile.lender.name}</p>
            </div>
            {loanFile.lender.contactName && (
              <div>
                <p className="text-xs text-muted">Contact</p>
                <p className="text-ink">{loanFile.lender.contactName}</p>
              </div>
            )}
            {loanFile.lender.contactEmail && (
              <div>
                <p className="text-xs text-muted">Email</p>
                <a href={`mailto:${loanFile.lender.contactEmail}`} className="text-primary hover:underline">
                  {loanFile.lender.contactEmail}
                </a>
              </div>
            )}
            {loanFile.lender.contactPhone && (
              <div>
                <p className="text-xs text-muted">Phone</p>
                <p className="text-ink">{loanFile.lender.contactPhone}</p>
              </div>
            )}
            {loanFile.lender.minCreditScore && (
              <div>
                <p className="text-xs text-muted">Min. credit score</p>
                <p className="text-ink">{loanFile.lender.minCreditScore}</p>
              </div>
            )}
            {loanFile.lender.programs.length > 0 && (
              <div>
                <p className="text-xs text-muted">Programs</p>
                <p className="text-ink">{loanFile.lender.programs.join(", ")}</p>
              </div>
            )}
            {loanFile.lender.submissionNotes && (
              <div className="col-span-2">
                <p className="text-xs text-muted">Submission notes</p>
                <p className="text-ink text-sm">{loanFile.lender.submissionNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {loanFile.notes && (
        <div className="bg-white rounded-xl border border-secondary-soft p-5">
          <h2 className="text-sm font-semibold text-ink mb-2">Notes</h2>
          <p className="text-sm text-muted whitespace-pre-wrap">{loanFile.notes}</p>
        </div>
      )}
    </div>
  )
}
