import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import LenderForm from "../LenderForm"

export default async function NewLenderPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:write")) redirect("/lenders")

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <a href="/lenders" className="text-sm text-muted hover:text-ink transition-colors">← Lenders</a>
        <h1 className="text-2xl font-semibold text-ink mt-2">Add Lender</h1>
      </div>
      <LenderForm />
    </div>
  )
}
