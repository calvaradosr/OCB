import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import Link from "next/link"
import AffiliateForm from "../AffiliateForm"

export default async function NewAffiliatePage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "clients:write")) redirect("/affiliates")

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/affiliates" className="text-sm text-muted hover:text-ink transition-colors">← Affiliates</Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">Add Affiliate</h1>
      </div>
      <AffiliateForm />
    </div>
  )
}
