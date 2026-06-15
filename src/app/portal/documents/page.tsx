import { getPortalClient } from "@/lib/portal"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, formatFileSize } from "@/lib/client-utils"
import PortalDocumentUpload from "./PortalDocumentUpload"

const CHECKLIST: Array<{ category: string; label: string; description: string; required: boolean }> = [
  {
    category: "ID",
    label: "Government-issued ID",
    description: "Driver's license, passport, or state ID (front & back)",
    required: true,
  },
  {
    category: "PROOF_OF_ADDRESS",
    label: "Proof of Address",
    description: "Utility bill, bank statement, or lease — dated within 60 days",
    required: true,
  },
  {
    category: "UTILITY_BILL",
    label: "Utility Bill",
    description: "Electric, gas, or water bill — supports address verification",
    required: false,
  },
  {
    category: "OTHER",
    label: "Other",
    description: "Any additional supporting documents",
    required: false,
  },
]

export default async function PortalDocuments() {
  const { client, session } = await getPortalClient()

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "PortalDocuments",
    entityId: client.id,
  }).catch(() => {})

  const documents = await db.document.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  })

  const byCategory = DOCUMENT_CATEGORIES.reduce<Record<string, typeof documents>>(
    (acc, cat) => { acc[cat] = documents.filter(d => d.category === cat); return acc },
    {}
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Documents</h1>
        <p className="text-muted mt-1">
          Upload the required documents below. All files are stored securely and encrypted.
        </p>
      </div>

      {/* Checklist */}
      <div className="space-y-4">
        {CHECKLIST.map(item => {
          const uploaded = byCategory[item.category] ?? []
          const done = uploaded.length > 0

          return (
            <div
              key={item.category}
              className="bg-white rounded-lg border border-secondary-soft p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      done
                        ? "border-success bg-success"
                        : item.required
                        ? "border-warning"
                        : "border-secondary"
                    }`}
                  >
                    {done && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {item.label}
                      {item.required && !done && (
                        <span className="ml-2 text-xs text-warning">Required</span>
                      )}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{item.description}</p>
                  </div>
                </div>

                {!done && (
                  <PortalDocumentUpload category={item.category as (typeof DOCUMENT_CATEGORIES)[number]} />
                )}
              </div>

              {uploaded.length > 0 && (
                <div className="mt-3 ml-8 space-y-1">
                  {uploaded.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 text-xs text-muted">
                      <svg className="h-3 w-3 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                      <span>{doc.fileName}</span>
                      <span>·</span>
                      <span>{doc.fileSize ? formatFileSize(doc.fileSize) : ""}</span>
                      <span>·</span>
                      <span>{doc.createdAt.toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
