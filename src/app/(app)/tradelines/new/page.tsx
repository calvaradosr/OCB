import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import TradelineForm from "../TradelineForm"

export default async function NewTradelinePage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "tradelines:write")) redirect("/tradelines")
  const { orgId } = session.user

  const vendors = await db.tradelineVendor.findMany({
    where: { orgId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <a href="/tradelines" className="text-sm text-muted hover:text-ink transition-colors">← Tradelines</a>
        <h1 className="text-2xl font-semibold text-ink mt-2">Add Tradeline</h1>
      </div>
      <TradelineForm vendors={vendors} />
    </div>
  )
}
