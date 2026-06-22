import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import Link from "next/link"
import VendorForm from "../../VendorForm"
import { PayoutsPanel } from "./PayoutsPanel"

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

  const unpaidOrders = await db.tradelineOrder.findMany({
    where: {
      tradeline: { vendorId: id },
      vendorPaidAt: null,
      status: { in: ["POSTED", "REMOVED"] },
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      tradeline: { select: { bank: true } },
    },
    orderBy: { createdAt: "asc" },
  })

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

      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Vendor Payouts</h2>
        <PayoutsPanel vendorId={id} unpaidOrders={unpaidOrders} />
      </div>
    </div>
  )
}
