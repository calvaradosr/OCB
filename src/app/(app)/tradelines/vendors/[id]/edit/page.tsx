import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import VendorForm from "../../VendorForm"

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "tradelines:write")) redirect("/tradelines/vendors")

  const vendor = await db.tradelineVendor.findUnique({ where: { id } })
  if (!vendor) notFound()

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/tradelines/vendors" className="text-sm text-muted hover:text-ink transition-colors">← Vendors</Link>
        <h1 className="text-2xl font-semibold text-ink mt-2">Edit Vendor</h1>
      </div>
      <VendorForm
        defaults={{
          id: vendor.id,
          name: vendor.name,
          contactName: vendor.contactName ?? "",
          contactEmail: vendor.contactEmail ?? "",
          contactPhone: vendor.contactPhone ?? "",
          payoutTerms: vendor.payoutTerms ?? "",
          active: vendor.active,
        }}
      />
    </div>
  )
}
