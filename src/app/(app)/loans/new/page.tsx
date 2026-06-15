import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import NewLoanForm from "./NewLoanForm"

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "loans:write")) redirect("/loans")

  const { clientId } = await searchParams

  const [clients, lenders, processors] = await Promise.all([
    db.client.findMany({
      where: { status: { not: "LEAD" } },
      select: { id: true, firstName: true, lastName: true, status: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.lender.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: { in: ["LOAN_PROCESSOR", "MANAGER", "ADMIN"] }, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <a href="/loans" className="text-sm text-muted hover:text-ink transition-colors">
          ← Loan Pipeline
        </a>
        <h1 className="text-2xl font-semibold text-ink mt-2">New Loan File</h1>
      </div>
      <NewLoanForm
        clients={clients}
        lenders={lenders}
        processors={processors}
        defaultClientId={clientId}
      />
    </div>
  )
}
