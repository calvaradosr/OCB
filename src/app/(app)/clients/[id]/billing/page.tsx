import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import InvoiceActions from "./InvoiceActions"
import CreateInvoiceForm from "./CreateInvoiceForm"
import SubscriptionPanel from "./SubscriptionPanel"

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-muted",
  OPEN: "text-warning",
  PAID: "text-success",
  FAILED: "text-danger",
  VOID: "text-muted",
}

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: clientId } = await params
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "billing:read")) redirect("/dashboard")

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      stripeCustomerId: true,
      invoices: { orderBy: { createdAt: "desc" } },
      subscriptions: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!client) redirect("/clients")

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "ClientBilling",
    entityId: clientId,
  }).catch(() => {})

  const canWrite = can(session.user.role, "billing:write")

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">
        Billing — {client.firstName} {client.lastName}
      </h2>

      {/* Subscription */}
      <SubscriptionPanel
        clientId={clientId}
        stripeCustomerId={client.stripeCustomerId}
        subscriptions={client.subscriptions.map(s => ({
          id: s.id,
          stripeSubscriptionId: s.stripeSubscriptionId,
          status: s.status,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
        }))}
        canWrite={canWrite}
      />

      {/* Invoices */}
      <div className="bg-white rounded-lg border border-secondary-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-soft flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Invoices</h3>
          {canWrite && <CreateInvoiceForm clientId={clientId} />}
        </div>

        {client.invoices.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Description</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Amount</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Status</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Work Performed</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Date</th>
                {canWrite && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {client.invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-secondary-soft/30">
                  <td className="px-5 py-3 text-ink">{inv.description}</td>
                  <td className="px-5 py-3 font-medium text-ink">{dollars(inv.amountCents)}</td>
                  <td className={`px-5 py-3 font-medium ${STATUS_COLOR[inv.status] ?? "text-muted"}`}>
                    {inv.status}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {inv.workPerformedAt ? inv.workPerformedAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{inv.createdAt.toLocaleDateString()}</td>
                  {canWrite && (
                    <td className="px-5 py-3">
                      <InvoiceActions
                        invoiceId={inv.id}
                        status={inv.status}
                        workPerformedAt={inv.workPerformedAt?.toISOString() ?? null}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
