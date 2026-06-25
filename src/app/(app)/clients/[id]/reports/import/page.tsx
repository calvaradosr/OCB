import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import ImportWizard from "./ImportWizard"
import BureauImportPanel from "./BureauImportPanel"
import { getBureauCredentials } from "@/app/actions/bureau-creds"

// Tab param: ?tab=auto (default) | ?tab=manual
type TabValue = "auto" | "manual"

export default async function ImportReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const { tab: tabParam } = await searchParams
  const activeTab: TabValue = tabParam === "manual" ? "manual" : "auto"

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  // Fetch existing bureau credentials for the panel
  const initialCreds = await getBureauCredentials(id)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink transition-colors">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink transition-colors">
          {client.firstName} {client.lastName}
        </Link>
        <span>›</span>
        <Link href={`/clients/${id}/reports`} className="hover:text-ink transition-colors">Reports</Link>
        <span>›</span>
        <span className="text-ink font-medium">Import</span>
      </nav>

      <h1 className="text-2xl font-bold text-ink">Import Credit Report</h1>

      {/* Tab bar */}
      <div className="border-b border-secondary-soft">
        <nav className="flex gap-0" aria-label="Import method tabs">
          <Link
            href={`/clients/${id}/reports/import?tab=auto`}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "auto"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Auto-Import (Bureau Login)
          </Link>
          <Link
            href={`/clients/${id}/reports/import?tab=manual`}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "manual"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Manual Entry
          </Link>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "auto" ? (
        <BureauImportPanel clientId={id} initialCreds={initialCreds} />
      ) : (
        <ImportWizard clientId={id} />
      )}
    </div>
  )
}
