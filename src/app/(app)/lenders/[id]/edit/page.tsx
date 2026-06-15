import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import LenderForm from "../../LenderForm"

export default async function EditLenderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:write")) redirect("/lenders")

  const lender = await db.lender.findUnique({ where: { id } })
  if (!lender) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <a href="/lenders" className="text-sm text-muted hover:text-ink transition-colors">← Lenders</a>
        <h1 className="text-2xl font-semibold text-ink mt-2">Edit Lender</h1>
      </div>
      <LenderForm
        defaults={{
          id: lender.id,
          name: lender.name,
          contactName: lender.contactName ?? undefined,
          contactEmail: lender.contactEmail ?? undefined,
          contactPhone: lender.contactPhone ?? undefined,
          programs: lender.programs,
          minCreditScore: lender.minCreditScore,
          submissionNotes: lender.submissionNotes ?? undefined,
          active: lender.active,
        }}
      />
    </div>
  )
}
