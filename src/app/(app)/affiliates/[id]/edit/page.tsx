import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import EditAffiliateForm from "./EditAffiliateForm"

export default async function EditAffiliatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "clients:write")) redirect("/affiliates")

  const affiliate = await db.affiliate.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!affiliate) notFound()

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/affiliates" className="text-sm text-muted hover:text-ink transition-colors">← Affiliates</Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">Edit Affiliate — {affiliate.user.name}</h1>
      </div>
      <EditAffiliateForm
        affiliateId={id}
        defaults={{ commissionPct: affiliate.commissionPct, active: affiliate.active }}
      />
    </div>
  )
}
