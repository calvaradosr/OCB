import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import Link from "next/link"
import VendorForm from "../VendorForm"

export default async function NewVendorPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "tradelines:write")) redirect("/tradelines/vendors")

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/tradelines/vendors" className="text-sm text-muted hover:text-ink transition-colors">← Vendors</Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">Add Vendor</h1>
      </div>
      <VendorForm />
    </div>
  )
}
