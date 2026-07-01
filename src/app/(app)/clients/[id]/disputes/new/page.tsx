import { auth } from "@/auth"
import { db } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import DisputeWizard from "./DisputeWizard"

export default async function NewDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!client) notFound()

  const items = await db.reportItem.findMany({
    where: { clientId: id },
    orderBy: [{ flagged: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      creditorName: true,
      accountNumberMasked: true,
      type: true,
      onExperian: true,
      onEquifax: true,
      onTransunion: true,
      flagged: true,
    },
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <nav className="text-sm text-muted flex items-center gap-2">
        <Link href="/clients" className="hover:text-ink">Clients</Link>
        <span>›</span>
        <Link href={`/clients/${id}`} className="hover:text-ink">{client.firstName} {client.lastName}</Link>
        <span>›</span>
        <Link href={`/clients/${id}/disputes`} className="hover:text-ink">Blocks</Link>
        <span>›</span>
        <span className="text-ink font-medium">New Block</span>
      </nav>

      <h1 className="text-2xl font-bold text-ink">Blocking Wizard</h1>

      {items.length === 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-sm text-warning">
          No report items found for this client.{" "}
          <Link href={`/clients/${id}/reports/import`} className="underline">
            Import a credit report first.
          </Link>
        </div>
      )}

      <DisputeWizard clientId={id} items={items} />
    </div>
  )
}
