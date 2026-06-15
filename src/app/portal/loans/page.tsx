import { getPortalClient } from "@/lib/portal"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import {
  LOAN_STATUS_LABELS,
  LOAN_STATUS_COLORS,
  LOAN_TYPE_LABELS,
  PIPELINE_STAGES,
  LOAN_DOC_CHECKLIST,
  LOAN_DOC_LABELS,
} from "@/lib/loan-utils"
import PortalLoanDocUpload from "./PortalLoanDocUpload"

export default async function PortalLoans() {
  const { client, session } = await getPortalClient()

  if (!client.modules.includes("LOAN")) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">You do not have a loan file on file.</p>
        <p className="text-sm text-muted mt-1">Contact your specialist if you believe this is an error.</p>
      </div>
    )
  }

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "PortalLoans",
    entityId: client.id,
  }).catch(() => {})

  const loanFiles = await db.loanFile.findMany({
    where: { clientId: client.id },
    include: {
      lender: { select: { name: true, contactName: true, contactEmail: true } },
      conditions: { where: { status: "OPEN" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  })

  if (loanFiles.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">No loan files yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Loan Status</h1>
        <p className="text-muted mt-1">Track the progress of your loan application.</p>
      </div>

      {loanFiles.map(file => {
        const stageIndex = PIPELINE_STAGES.indexOf(file.status)
        const statusColors = LOAN_STATUS_COLORS[file.status]
        const requiredDocs = LOAN_DOC_CHECKLIST[file.type]
        const uploadedByCategory = file.documents.reduce<Record<string, number>>(
          (acc, d) => { acc[d.category] = (acc[d.category] ?? 0) + 1; return acc },
          {}
        )

        return (
          <div key={file.id} className="space-y-4">
            {/* Status header */}
            <div className="bg-white rounded-xl border border-secondary-soft p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">{LOAN_TYPE_LABELS[file.type]} Loan</p>
                  {file.amountRequestedCents && (
                    <p className="text-2xl font-bold text-ink mt-0.5">
                      ${(file.amountRequestedCents / 100).toLocaleString()}
                    </p>
                  )}
                </div>
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${statusColors.bg} ${statusColors.text}`}>
                  {LOAN_STATUS_LABELS[file.status]}
                </span>
              </div>

              {/* Pipeline stepper */}
              <div className="flex items-center gap-0 overflow-x-auto">
                {PIPELINE_STAGES.map((stage, i) => {
                  const done = stageIndex > i
                  const current = stageIndex === i
                  return (
                    <div key={stage} className="flex items-center">
                      <div className={`flex flex-col items-center px-1.5 ${current ? "opacity-100" : done ? "opacity-70" : "opacity-25"}`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          done ? "bg-success text-white" : current ? `${LOAN_STATUS_COLORS[stage].bg} ${LOAN_STATUS_COLORS[stage].text}` : "bg-secondary-soft text-muted"
                        }`}>
                          {done ? "✓" : i + 1}
                        </div>
                        <span className="text-xs text-muted mt-1 text-center leading-tight" style={{ fontSize: "10px", maxWidth: "52px" }}>
                          {LOAN_STATUS_LABELS[stage]}
                        </span>
                      </div>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <div className={`h-0.5 w-4 shrink-0 ${done ? "bg-success" : "bg-secondary-soft"}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Lender */}
              {file.lender && (
                <div className="mt-4 pt-4 border-t border-secondary-soft text-sm">
                  <p className="text-xs text-muted">Lender</p>
                  <p className="text-ink font-medium">{file.lender.name}</p>
                  {file.lender.contactName && <p className="text-muted text-xs">{file.lender.contactName}</p>}
                </div>
              )}
            </div>

            {/* Open conditions */}
            {file.conditions.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-warning mb-2">
                  {file.conditions.length} outstanding condition{file.conditions.length > 1 ? "s" : ""}
                </p>
                <ul className="space-y-1">
                  {file.conditions.map(c => (
                    <li key={c.id} className="text-sm text-ink flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                      {c.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Document checklist */}
            <div className="bg-white rounded-xl border border-secondary-soft p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">Document Checklist</h2>
              <div className="space-y-3">
                {requiredDocs.map(cat => {
                  const count = uploadedByCategory[cat] ?? 0
                  const docs = file.documents.filter(d => d.category === cat)
                  return (
                    <div key={cat} className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          count > 0 ? "border-success bg-success" : "border-warning"
                        }`}>
                          {count > 0 && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink">{LOAN_DOC_LABELS[cat] ?? cat}</p>
                          {docs.map(d => (
                            <p key={d.id} className="text-xs text-muted">{d.fileName}</p>
                          ))}
                        </div>
                      </div>
                      <PortalLoanDocUpload loanFileId={file.id} category={cat} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
