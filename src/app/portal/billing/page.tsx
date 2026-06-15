import { getPortalClient } from "@/lib/portal"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import ManagePaymentButton from "./ManagePaymentButton"

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Pending",
  OPEN: "Due",
  PAID: "Paid",
  FAILED: "Payment failed",
  VOID: "Voided",
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-muted",
  OPEN: "text-warning",
  PAID: "text-success",
  FAILED: "text-danger",
  VOID: "text-muted",
}

export default async function PortalBilling() {
  const { client, session } = await getPortalClient()

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "PortalBilling",
    entityId: client.id,
  }).catch(() => {})

  const [invoices, subscriptions] = await Promise.all([
    db.invoice.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
    }),
    db.subscription.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const activeSub = subscriptions.find(s => s.status === "active" || s.status === "trialing")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Billing</h1>
        <p className="text-muted mt-1">Your invoices and payment information.</p>
      </div>

      {/* Subscription status */}
      <div className="bg-white rounded-lg border border-secondary-soft p-5 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Service Plan</h2>
        {activeSub ? (
          <div className="flex items-center justify-between">
            <div>
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                  activeSub.status === "active" ? "bg-green-50 text-success" : "bg-secondary-soft text-muted"
                }`}
              >
                {activeSub.cancelAtPeriodEnd ? "Canceling at period end" : "Active"}
              </span>
              {activeSub.currentPeriodEnd && (
                <p className="text-xs text-muted mt-1">
                  {activeSub.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                  {activeSub.currentPeriodEnd.toLocaleDateString()}
                </p>
              )}
            </div>

            {client.stripeCustomerId && (
              <ManagePaymentButton clientId={client.id} />
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">No active service plan. Contact your specialist to get started.</p>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-lg border border-secondary-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-soft">
          <h2 className="text-sm font-semibold text-ink">Invoices</h2>
        </div>

        {invoices.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary-soft/50">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Description</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Amount</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Status</th>
                <th className="px-5 py-2.5 text-left text-xs text-muted font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-soft">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-secondary-soft/30">
                  <td className="px-5 py-3 text-ink">{inv.description}</td>
                  <td className="px-5 py-3 font-medium text-ink">{dollars(inv.amountCents)}</td>
                  <td className={`px-5 py-3 font-medium ${STATUS_COLOR[inv.status] ?? "text-muted"}`}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </td>
                  <td className="px-5 py-3 text-muted">{inv.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
