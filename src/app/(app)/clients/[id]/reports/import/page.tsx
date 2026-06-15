import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import ImportWizard from "./ImportWizard"

export default async function ImportReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <Link href={`/clients/${id}/reports`} className="hover:text-ink">Reports</Link>
        <span>›</span>
        <span className="text-ink font-medium">Import</span>
      </nav>

      <h1 className="text-2xl font-bold text-ink">Import Credit Report</h1>

      <ImportWizard clientId={id} />
    </div>
  )
}
