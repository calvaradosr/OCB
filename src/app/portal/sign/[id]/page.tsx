import { getPortalClient } from "@/lib/portal"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import SignaturePad from "./SignaturePad"

export default async function SignAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: agreementId } = await params
  const { client } = await getPortalClient()

  const agreement = await db.agreement.findUnique({ where: { id: agreementId } })
  if (!agreement || agreement.clientId !== client.id) redirect("/portal/dashboard")

  if (agreement.status === "SIGNED") {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-4 py-16">
        <div className="text-5xl">✓</div>
        <h1 className="text-2xl font-semibold text-success">Already signed</h1>
        <p className="text-muted">
          This document was signed on {agreement.signedAt?.toLocaleDateString()}.
        </p>
        <a href="/portal/dashboard" className="text-primary hover:underline text-sm">
          Return to dashboard
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          {agreement.type.replace(/_/g, " ")}
        </h1>
        <p className="text-muted mt-1 text-sm">
          Please read the document below carefully, then sign at the bottom.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-secondary-soft p-6">
        <pre className="text-sm text-ink font-mono leading-relaxed whitespace-pre-wrap">
          {agreement.body}
        </pre>
      </div>

      <SignaturePad agreementId={agreementId} />
    </div>
  )
}
